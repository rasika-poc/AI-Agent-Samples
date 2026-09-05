-- Application role: must NOT be a superuser and must NOT own these tables, or
-- Postgres exempts it from Row-Level Security regardless of the policies below.
-- (PLAN.md §10: "RLS as the non-negotiable floor for tenant isolation.")
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'weboffice_app') THEN
        CREATE ROLE weboffice_app LOGIN PASSWORD 'weboffice_app_dev_password';
    END IF;
END$$;

GRANT USAGE ON SCHEMA public TO weboffice_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO weboffice_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO weboffice_app;

-- `tenants` itself: no tenant_id column (its own `id` is the tenant), so the
-- isolation predicate compares against `id` directly. The app role gets no
-- INSERT path here in Phase 0 — tenant creation is a seed/bootstrap operation
-- (03_seed.sql) run as the table owner; self-serve tenant signup is PLAN.md §20.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants
    USING (id = current_setting('app.tenant_id', true)::uuid);
REVOKE INSERT, DELETE ON tenants FROM weboffice_app;

-- `users` and `group_memberships` are intentionally NOT included below —
-- `users` is a global identity table by design (PLAN.md §4/§6: a user must be
-- reachable across tenants for cross-tenant sharing to work at all), and
-- `group_memberships` has no tenant_id of its own (it's reached via `groups`).

CREATE OR REPLACE FUNCTION apply_tenant_isolation(table_name text) RETURNS void AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I
            USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid)
            WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
        table_name
    );
END;
$$ LANGUAGE plpgsql;

SELECT apply_tenant_isolation('memberships');
SELECT apply_tenant_isolation('groups');
SELECT apply_tenant_isolation('invites');
SELECT apply_tenant_isolation('folders');
SELECT apply_tenant_isolation('files');
SELECT apply_tenant_isolation('file_versions');
SELECT apply_tenant_isolation('doc_snapshots');
SELECT apply_tenant_isolation('doc_assets');
SELECT apply_tenant_isolation('permissions');
SELECT apply_tenant_isolation('share_links');
SELECT apply_tenant_isolation('audit_log');

DROP FUNCTION apply_tenant_isolation(text);

-- `tenant_policies` uses `tenant_id` as its primary key, not a foreign-key
-- column alongside a separate id — same predicate, applied by hand since the
-- helper function above assumes a `tenant_id` column exists (it does here too,
-- so this could have used the helper, but is spelled out for clarity).
ALTER TABLE tenant_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_policies
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

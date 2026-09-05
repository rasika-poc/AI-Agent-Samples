-- Phase 0 is explicitly single-tenant (PLAN.md §11 Phase 0): self-serve tenant
-- signup/provisioning is PLAN.md §20, built in Phase 2+. For now, seed one
-- default tenant as the table owner (bypasses the RLS just installed) so the
-- app role has somewhere to attach users via /auth/signup.
INSERT INTO tenants (id, name, plan, storage_quota_bytes)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'free', 5368709120)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenant_policies (tenant_id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (tenant_id) DO NOTHING;

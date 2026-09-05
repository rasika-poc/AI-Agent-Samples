-- WebOffice metadata schema (see PLAN.md §4).
-- Note: `permissions`, `share_links`, `file_versions`, and `doc_snapshots` gained a
-- `tenant_id` column here even though PLAN.md's prose listing omitted it — every
-- table protected by the tenant-isolation RLS policy in 02_roles_rls.sql needs one,
-- per PLAN.md §4's own stated rule ("every tenant-scoped table carries tenant_id").

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    plan                TEXT NOT NULL DEFAULT 'free',
    storage_quota_bytes BIGINT NOT NULL DEFAULT 5368709120, -- 5 GiB
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global identity: no tenant_id. See PLAN.md §4/§6 — this is what makes
-- cross-tenant/external sharing representable.
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    password_hash TEXT,
    sso_subject   TEXT,
    sso_provider  TEXT,
    mfa_enrolled  BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tenant_id)
);

CREATE TABLE groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'native' CHECK (source IN ('native', 'scim')),
    external_id TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_memberships (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE invites (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email            TEXT NOT NULL,
    resource_type    TEXT NOT NULL CHECK (resource_type IN ('file', 'folder', 'tenant')),
    resource_id      UUID,
    role             TEXT NOT NULL,
    invited_by       UUID NOT NULL REFERENCES users(id),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token            TEXT NOT NULL UNIQUE,
    accepted_user_id UUID REFERENCES users(id),
    expires_at       TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_policies (
    tenant_id               UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enforce_sso             BOOLEAN NOT NULL DEFAULT false,
    allow_external_sharing  BOOLEAN NOT NULL DEFAULT true,
    mfa_required            BOOLEAN NOT NULL DEFAULT false,
    ip_allowlist            JSONB,
    session_timeout_minutes INTEGER NOT NULL DEFAULT 480,
    data_residency_region   TEXT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE folders (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id  UUID REFERENCES folders(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    owner_id   UUID NOT NULL REFERENCES users(id),
    version    INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE files (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    folder_id           UUID REFERENCES folders(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    mime_type           TEXT NOT NULL,
    size_bytes          BIGINT NOT NULL DEFAULT 0,
    owner_id            UUID NOT NULL REFERENCES users(id),
    s3_key              TEXT NOT NULL,
    current_version_id  UUID,
    version             INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE TABLE file_versions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_id    UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    s3_key     TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    label      TEXT
);

ALTER TABLE files
    ADD CONSTRAINT fk_files_current_version
    FOREIGN KEY (current_version_id) REFERENCES file_versions(id);

CREATE TABLE doc_snapshots (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_id          UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    yjs_state_s3_key TEXT NOT NULL,
    size_bytes       BIGINT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE doc_assets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_id     UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    s3_key      TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    size_bytes  BIGINT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('file', 'folder')),
    resource_id   UUID NOT NULL,
    subject_type  TEXT NOT NULL CHECK (subject_type IN ('user', 'group', 'link')),
    subject_id    UUID NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('viewer', 'commenter', 'editor', 'owner')),
    inherited     BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE share_links (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('file', 'folder')),
    resource_id   UUID NOT NULL,
    token         TEXT NOT NULL UNIQUE,
    role          TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
    password_hash TEXT,
    expires_at    TIMESTAMPTZ,
    created_by    UUID NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id      UUID REFERENCES users(id),
    actor_label   TEXT,
    action        TEXT NOT NULL,
    resource_type TEXT,
    resource_id   UUID,
    meta          JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memberships_tenant ON memberships(tenant_id);
CREATE INDEX idx_groups_tenant ON groups(tenant_id);
CREATE INDEX idx_folders_tenant_parent ON folders(tenant_id, parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_tenant_folder ON files(tenant_id, folder_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_file_versions_file ON file_versions(file_id);
CREATE INDEX idx_permissions_resource ON permissions(tenant_id, resource_type, resource_id);
CREATE INDEX idx_share_links_token ON share_links(token);
CREATE INDEX idx_audit_log_tenant_created ON audit_log(tenant_id, created_at DESC);

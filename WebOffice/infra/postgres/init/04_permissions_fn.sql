-- Phase 1: single source of truth for "what role does this user have on this
-- file", shared by api-files (Python) and collab-server (Node) so the access
-- rule isn't duplicated in two languages. Runs as the invoking role (default
-- for a plain SQL function), so it's still subject to RLS on files/folders/
-- permissions — it can only see what the caller's app.tenant_id already allows.
--
-- Precedence: direct file ownership > direct file grant > folder grant, with
-- folder grants ranked by proximity (the file's immediate parent wins over a
-- more distant ancestor) — PLAN.md §5's folder-level inheritance.
CREATE OR REPLACE FUNCTION resolve_file_role(p_file_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
    WITH RECURSIVE ancestors AS (
        SELECT folder_id AS id, 0 AS depth FROM files WHERE id = p_file_id
        UNION ALL
        SELECT f.parent_id, a.depth + 1
        FROM folders f JOIN ancestors a ON f.id = a.id
        WHERE f.parent_id IS NOT NULL
    )
    SELECT role FROM (
        SELECT 'owner' AS role, -2 AS depth FROM files WHERE id = p_file_id AND owner_id = p_user_id
        UNION ALL
        SELECT role, -1 AS depth FROM permissions
        WHERE resource_type = 'file' AND resource_id = p_file_id
          AND subject_type = 'user' AND subject_id = p_user_id
        UNION ALL
        SELECT p.role, a.depth FROM permissions p
        JOIN ancestors a ON a.id = p.resource_id
        WHERE p.resource_type = 'folder' AND p.subject_type = 'user' AND p.subject_id = p_user_id
    ) ranked
    ORDER BY depth ASC
    LIMIT 1
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION resolve_file_role(UUID, UUID) TO weboffice_app;

-- One grant per (resource, subject) — sharing again with a new role updates
-- the existing grant (ON CONFLICT ... DO UPDATE) instead of accumulating rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_unique_grant
    ON permissions (tenant_id, resource_type, resource_id, subject_type, subject_id);

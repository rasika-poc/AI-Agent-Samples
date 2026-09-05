from typing import Optional
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import CurrentUser, get_current_user, get_db
from ..schemas import FileOut, FolderContents, FolderCreate, FolderOut, FolderUpdate

router = APIRouter(prefix="/folders", tags=["folders"])

# Phase 0 has no per-resource role checks yet (viewer/commenter/editor/owner is
# PLAN.md §5, wired once sharing exists) — every tenant member can read/write
# any folder in their own tenant. Tenant isolation itself is already real,
# enforced by Postgres RLS (see deps.get_db), not by this service's own logic.


@router.post("", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
async def create_folder(
    body: FolderCreate,
    user: CurrentUser = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> FolderOut:
    if body.parent_id is not None:
        parent = await conn.fetchrow(
            "SELECT id FROM folders WHERE id = $1 AND deleted_at IS NULL", body.parent_id
        )
        if parent is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "parent folder not found")

    row = await conn.fetchrow(
        """
        INSERT INTO folders (tenant_id, parent_id, name, owner_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, parent_id, name, owner_id, version, created_at, updated_at
        """,
        user.tenant_id,
        body.parent_id,
        body.name,
        user.user_id,
    )
    await conn.execute(
        """
        INSERT INTO audit_log (tenant_id, actor_id, action, resource_type, resource_id)
        VALUES ($1, $2, 'folder.create', 'folder', $3)
        """,
        user.tenant_id,
        user.user_id,
        row["id"],
    )
    return FolderOut(**row)


@router.get("", response_model=FolderContents)
async def list_root(conn: asyncpg.Connection = Depends(get_db)) -> FolderContents:
    return await _folder_contents(conn, None)


@router.get("/{folder_id}", response_model=FolderContents)
async def get_folder(folder_id: UUID, conn: asyncpg.Connection = Depends(get_db)) -> FolderContents:
    folder_row = await conn.fetchrow(
        "SELECT id, parent_id, name, owner_id, version, created_at, updated_at "
        "FROM folders WHERE id = $1 AND deleted_at IS NULL",
        folder_id,
    )
    if folder_row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "folder not found")
    return await _folder_contents(conn, folder_id, folder_row)


async def _folder_contents(
    conn: asyncpg.Connection, folder_id: Optional[UUID], folder_row: Optional[asyncpg.Record] = None
) -> FolderContents:
    subfolder_rows = await conn.fetch(
        """
        SELECT id, parent_id, name, owner_id, version, created_at, updated_at
        FROM folders
        WHERE deleted_at IS NULL AND parent_id IS NOT DISTINCT FROM $1
        ORDER BY name
        """,
        folder_id,
    )
    file_rows = await conn.fetch(
        """
        SELECT id, folder_id, name, mime_type, size_bytes, owner_id, version, created_at, updated_at
        FROM files
        WHERE deleted_at IS NULL AND folder_id IS NOT DISTINCT FROM $1
        ORDER BY name
        """,
        folder_id,
    )
    return FolderContents(
        folder=FolderOut(**folder_row) if folder_row else None,
        subfolders=[FolderOut(**r) for r in subfolder_rows],
        files=[FileOut(**r) for r in file_rows],
    )


@router.patch("/{folder_id}", response_model=FolderOut)
async def update_folder(
    folder_id: UUID,
    body: FolderUpdate,
    user: CurrentUser = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> FolderOut:
    """Optimistic concurrency per PLAN.md §18: the caller must supply the version it last read."""
    row = await conn.fetchrow(
        """
        UPDATE folders
        SET name = COALESCE($1, name),
            parent_id = CASE WHEN $2::boolean THEN $3 ELSE parent_id END,
            version = version + 1,
            updated_at = now()
        WHERE id = $4 AND version = $5 AND deleted_at IS NULL
        RETURNING id, parent_id, name, owner_id, version, created_at, updated_at
        """,
        body.name,
        "parent_id" in body.model_fields_set,
        body.parent_id,
        folder_id,
        body.version,
    )
    if row is None:
        existing = await conn.fetchval(
            "SELECT version FROM folders WHERE id = $1 AND deleted_at IS NULL", folder_id
        )
        if existing is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "folder not found")
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"folder was modified by someone else (current version is {existing})",
        )
    await conn.execute(
        """
        INSERT INTO audit_log (tenant_id, actor_id, action, resource_type, resource_id)
        VALUES ($1, $2, 'folder.update', 'folder', $3)
        """,
        user.tenant_id,
        user.user_id,
        folder_id,
    )
    return FolderOut(**row)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> None:
    """
    Soft delete, cascading to the full subtree (PLAN.md §19) — trashed items
    keep counting against the tenant's storage quota and stay restorable until
    a later retention-purge job removes them; that job doesn't exist yet in
    Phase 0, only the soft-delete half does.
    """
    subtree_ids = await conn.fetch(
        """
        WITH RECURSIVE subtree AS (
            SELECT id FROM folders WHERE id = $1 AND deleted_at IS NULL
            UNION ALL
            SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id WHERE f.deleted_at IS NULL
        )
        SELECT id FROM subtree
        """,
        folder_id,
    )
    if not subtree_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "folder not found")
    ids = [r["id"] for r in subtree_ids]
    await conn.execute("UPDATE folders SET deleted_at = now() WHERE id = ANY($1::uuid[])", ids)
    await conn.execute(
        "UPDATE files SET deleted_at = now() WHERE folder_id = ANY($1::uuid[]) AND deleted_at IS NULL",
        ids,
    )
    await conn.execute(
        """
        INSERT INTO audit_log (tenant_id, actor_id, action, resource_type, resource_id)
        VALUES ($1, $2, 'folder.delete', 'folder', $3)
        """,
        user.tenant_id,
        user.user_id,
        folder_id,
    )

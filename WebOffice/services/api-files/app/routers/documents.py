from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import CurrentUser, get_current_user, get_db
from ..permissions import resolve_role, role_at_least
from ..schemas import DOCUMENT_MIME_TYPE, DocumentCreate, DocumentOut, PermissionOut, ShareRequest

router = APIRouter(prefix="/documents", tags=["documents"])

GRANTABLE_ROLES = {"viewer", "commenter", "editor"}


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def create_document(
    body: DocumentCreate,
    user: CurrentUser = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> DocumentOut:
    if body.folder_id is not None:
        parent = await conn.fetchrow(
            "SELECT id FROM folders WHERE id = $1 AND deleted_at IS NULL", body.folder_id
        )
        if parent is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "folder not found")

    row = await conn.fetchrow(
        """
        INSERT INTO files (tenant_id, folder_id, name, mime_type, owner_id, s3_key)
        VALUES ($1, $2, $3, $4, $5, 'weboffice://doc-not-yet-snapshotted')
        RETURNING id, folder_id, name, owner_id, created_at, updated_at
        """,
        user.tenant_id,
        body.folder_id,
        body.name,
        DOCUMENT_MIME_TYPE,
        user.user_id,
    )
    await conn.execute(
        """
        INSERT INTO audit_log (tenant_id, actor_id, action, resource_type, resource_id)
        VALUES ($1, $2, 'document.create', 'file', $3)
        """,
        user.tenant_id,
        user.user_id,
        row["id"],
    )
    return DocumentOut(**row, role="owner")


@router.get("", response_model=list[DocumentOut])
async def list_documents(
    user: CurrentUser = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> list[DocumentOut]:
    """Documents the caller owns or has been granted access to, directly or via a folder."""
    rows = await conn.fetch(
        """
        SELECT id, folder_id, name, owner_id, created_at, updated_at,
               resolve_file_role(id, $1) AS role
        FROM files
        WHERE mime_type = $2 AND deleted_at IS NULL
        ORDER BY updated_at DESC
        """,
        user.user_id,
        DOCUMENT_MIME_TYPE,
    )
    return [DocumentOut(**r) for r in rows if r["role"] is not None]


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> DocumentOut:
    row = await conn.fetchrow(
        """
        SELECT id, folder_id, name, owner_id, created_at, updated_at
        FROM files WHERE id = $1 AND mime_type = $2 AND deleted_at IS NULL
        """,
        document_id,
        DOCUMENT_MIME_TYPE,
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    role = await resolve_role(conn, str(document_id), user.user_id)
    if role is None:
        # Don't distinguish "doesn't exist" from "no access" to a caller with neither.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    return DocumentOut(**row, role=role)


@router.post("/{document_id}/share", response_model=PermissionOut, status_code=status.HTTP_201_CREATED)
async def share_document(
    document_id: UUID,
    body: ShareRequest,
    user: CurrentUser = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> PermissionOut:
    if body.role not in GRANTABLE_ROLES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"role must be one of {sorted(GRANTABLE_ROLES)}",
        )
    role = await resolve_role(conn, str(document_id), user.user_id)
    if not role_at_least(role, "owner"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only the owner can manage sharing")

    target = await conn.fetchrow("SELECT id, email, display_name FROM users WHERE email = $1", body.email)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no user with that email")

    row = await conn.fetchrow(
        """
        INSERT INTO permissions (tenant_id, resource_type, resource_id, subject_type, subject_id, role)
        VALUES ($1, 'file', $2, 'user', $3, $4)
        ON CONFLICT (tenant_id, resource_type, resource_id, subject_type, subject_id)
        DO UPDATE SET role = EXCLUDED.role
        RETURNING id, subject_type, subject_id, role, created_at
        """,
        user.tenant_id,
        document_id,
        target["id"],
        body.role,
    )
    row = {**row, "subject_email": target["email"], "subject_display_name": target["display_name"]}
    await conn.execute(
        """
        INSERT INTO audit_log (tenant_id, actor_id, action, resource_type, resource_id, meta)
        VALUES ($1, $2, 'document.share', 'file', $3, jsonb_build_object('email', $4::text, 'role', $5::text))
        """,
        user.tenant_id,
        user.user_id,
        document_id,
        body.email,
        body.role,
    )
    return PermissionOut(**row)


@router.get("/{document_id}/permissions", response_model=list[PermissionOut])
async def list_permissions(
    document_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> list[PermissionOut]:
    role = await resolve_role(conn, str(document_id), user.user_id)
    if not role_at_least(role, "owner"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only the owner can view sharing settings")
    rows = await conn.fetch(
        """
        SELECT p.id, p.subject_type, p.subject_id, p.role, p.created_at,
               u.email AS subject_email, u.display_name AS subject_display_name
        FROM permissions p
        LEFT JOIN users u ON p.subject_type = 'user' AND u.id = p.subject_id
        WHERE p.resource_type = 'file' AND p.resource_id = $1
        ORDER BY p.created_at
        """,
        document_id,
    )
    return [PermissionOut(**r) for r in rows]

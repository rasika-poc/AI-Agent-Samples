import json
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response

from ..config import settings
from ..deps import CurrentUser, get_current_user, get_db
from ..scanner import MalwareDetected, ScannerUnavailable, scan_bytes
from ..schemas import FileOut
from ..storage import delete_object, get_object, put_object

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload", response_model=FileOut, status_code=status.HTTP_201_CREATED)
async def upload_file(
    upload: UploadFile = File(...),
    folder_id: UUID | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> FileOut:
    data = await upload.read()
    if len(data) > settings.max_upload_size_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file exceeds the upload size limit")

    if folder_id is not None:
        parent = await conn.fetchrow(
            "SELECT id FROM folders WHERE id = $1 AND deleted_at IS NULL", folder_id
        )
        if parent is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "folder not found")

    # PLAN.md §22: scan before the object is ever written to S3 or referenced in Postgres.
    try:
        scan_bytes(data)
    except MalwareDetected as exc:
        await conn.execute(
            """
            INSERT INTO audit_log (tenant_id, actor_id, action, resource_type, meta)
            VALUES ($1, $2, 'upload.rejected_malware', 'file', $3::jsonb)
            """,
            user.tenant_id,
            user.user_id,
            json.dumps({"filename": upload.filename, "signature": exc.signature}),
        )
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"upload rejected: {exc}") from exc
    except ScannerUnavailable as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "malware scanner unavailable, try again shortly"
        ) from exc

    row = await conn.fetchrow(
        """
        INSERT INTO files (tenant_id, folder_id, name, mime_type, size_bytes, owner_id, s3_key)
        VALUES ($1, $2, $3, $4, $5, $6, '')
        RETURNING id, folder_id, name, mime_type, size_bytes, owner_id, version, created_at, updated_at
        """,
        user.tenant_id,
        folder_id,
        upload.filename,
        upload.content_type or "application/octet-stream",
        len(data),
        user.user_id,
    )
    file_id = row["id"]
    s3_key = f"{user.tenant_id}/{file_id}/v1/{upload.filename}"

    put_object(s3_key, data, upload.content_type or "application/octet-stream")

    version_id = await conn.fetchval(
        """
        INSERT INTO file_versions (tenant_id, file_id, s3_key, size_bytes, created_by, label)
        VALUES ($1, $2, $3, $4, $5, 'initial upload')
        RETURNING id
        """,
        user.tenant_id,
        file_id,
        s3_key,
        len(data),
        user.user_id,
    )
    await conn.execute(
        "UPDATE files SET s3_key = $1, current_version_id = $2 WHERE id = $3",
        s3_key,
        version_id,
        file_id,
    )
    await conn.execute(
        """
        INSERT INTO audit_log (tenant_id, actor_id, action, resource_type, resource_id)
        VALUES ($1, $2, 'file.upload', 'file', $3)
        """,
        user.tenant_id,
        user.user_id,
        file_id,
    )
    return FileOut(**row)


@router.get("/{file_id}", response_model=FileOut)
async def get_file(file_id: UUID, conn: asyncpg.Connection = Depends(get_db)) -> FileOut:
    row = await conn.fetchrow(
        """
        SELECT id, folder_id, name, mime_type, size_bytes, owner_id, version, created_at, updated_at
        FROM files WHERE id = $1 AND deleted_at IS NULL
        """,
        file_id,
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    return FileOut(**row)


@router.get("/{file_id}/download")
async def download_file(file_id: UUID, conn: asyncpg.Connection = Depends(get_db)) -> Response:
    row = await conn.fetchrow(
        "SELECT s3_key, name, mime_type FROM files WHERE id = $1 AND deleted_at IS NULL",
        file_id,
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    data = get_object(row["s3_key"])
    return Response(
        content=data,
        media_type=row["mime_type"],
        headers={"Content-Disposition": f'attachment; filename="{row["name"]}"'},
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> None:
    """Soft delete only (PLAN.md §19) — the S3 object is purged later by a retention job, not here."""
    result = await conn.execute(
        "UPDATE files SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL", file_id
    )
    if result == "UPDATE 0":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    await conn.execute(
        """
        INSERT INTO audit_log (tenant_id, actor_id, action, resource_type, resource_id)
        VALUES ($1, $2, 'file.delete', 'file', $3)
        """,
        user.tenant_id,
        user.user_id,
        file_id,
    )

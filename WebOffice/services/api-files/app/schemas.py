from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[UUID] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None
    version: int  # optimistic concurrency token, PLAN.md §18


class FolderOut(BaseModel):
    id: UUID
    parent_id: Optional[UUID]
    name: str
    owner_id: UUID
    version: int
    created_at: datetime
    updated_at: datetime


class FileOut(BaseModel):
    id: UUID
    folder_id: Optional[UUID]
    name: str
    mime_type: str
    size_bytes: int
    owner_id: UUID
    version: int
    created_at: datetime
    updated_at: datetime


class FolderContents(BaseModel):
    folder: Optional[FolderOut]
    subfolders: list[FolderOut]
    files: list[FileOut]

from dataclasses import dataclass
from typing import AsyncIterator

import asyncpg
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import tenant_connection
from .security import decode_access_token

_bearer = HTTPBearer()


@dataclass
class CurrentUser:
    user_id: str
    tenant_id: str
    role: str


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid or expired token"
        ) from exc
    return CurrentUser(user_id=payload["sub"], tenant_id=payload["tenant_id"], role=payload["role"])


async def get_db(
    current_user: CurrentUser = Depends(get_current_user),
) -> AsyncIterator[asyncpg.Connection]:
    """
    Per-request DB connection scoped to the caller's tenant. Every route that
    depends on this gets Row-Level Security enforcement for free (PLAN.md §5:
    "DB-level RLS as the floor") — there is no code path in this service that
    reads/writes tenant-scoped tables without going through here first.
    """
    async with tenant_connection(current_user.tenant_id) as conn:
        yield conn

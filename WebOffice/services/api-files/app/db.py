from contextlib import asynccontextmanager
from typing import AsyncIterator

import asyncpg

from .config import settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(settings.database_url, min_size=1, max_size=10)


async def close_pool() -> None:
    if _pool is not None:
        await _pool.close()


@asynccontextmanager
async def tenant_connection(tenant_id: str) -> AsyncIterator[asyncpg.Connection]:
    """
    Acquire a connection scoped to one tenant for the duration of a transaction.

    `SET LOCAL` doesn't accept bind parameters, so tenant scoping goes through
    `set_config(..., is_local=true)` instead — same transaction-local effect,
    without building a SQL string by hand (PLAN.md §4/§10: RLS is the floor,
    but only if the app can't accidentally bypass or mis-scope it).
    """
    assert _pool is not None, "call init_pool() before using tenant_connection()"
    async with _pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("SELECT set_config('app.tenant_id', $1, true)", tenant_id)
            yield conn


@asynccontextmanager
async def bootstrap_connection() -> AsyncIterator[asyncpg.Connection]:
    """
    A connection with no tenant context set — `current_setting('app.tenant_id', true)`
    returns NULL, so every tenant-scoped RLS policy matches nothing. Only used for
    cross-tenant lookups that must run before a tenant is known, e.g. resolving
    which tenant a login's email belongs to (`users`/`memberships` have no RLS —
    see 02_roles_rls.sql — so this is safe for those two tables specifically).
    """
    assert _pool is not None, "call init_pool() before using bootstrap_connection()"
    async with _pool.acquire() as conn:
        yield conn

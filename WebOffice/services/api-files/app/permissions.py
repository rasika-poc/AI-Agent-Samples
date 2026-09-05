import asyncpg

ROLE_RANK = {"viewer": 0, "commenter": 1, "editor": 2, "owner": 3}


async def resolve_role(conn: asyncpg.Connection, file_id: str, user_id: str) -> str | None:
    """Mirrors collab-server/src/auth.ts's role check — both call the same
    Postgres function (infra/postgres/init/04_permissions_fn.sql) so the
    access rule lives in one place rather than being reimplemented per service.
    """
    return await conn.fetchval("SELECT resolve_file_role($1, $2)", file_id, user_id)


def role_at_least(role: str | None, minimum: str) -> bool:
    if role is None:
        return False
    return ROLE_RANK[role] >= ROLE_RANK[minimum]

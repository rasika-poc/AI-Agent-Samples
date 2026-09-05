from fastapi import APIRouter, HTTPException, status

from ..config import settings
from ..db import bootstrap_connection
from ..schemas import LoginRequest, SignupRequest, TokenResponse
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest) -> TokenResponse:
    """
    Phase 0 scope only: every signup joins the single seeded default tenant
    (infra/postgres/init/03_seed.sql). Real tenant creation + the tenant-invite
    vs resource-share distinction is PLAN.md §20, built in Phase 2+.
    `users`/`memberships` carry no RLS (see 02_roles_rls.sql), so a plain
    connection with no tenant context set is correct here, not a shortcut.
    """
    async with bootstrap_connection() as conn:
        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", body.email)
        if existing is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "an account with this email already exists")

        tenant_id = settings.default_tenant_id

        # `memberships` carries the tenant-isolation RLS policy (02_roles_rls.sql), so every
        # statement that touches it — including this existence check — needs `app.tenant_id`
        # set first. `set_config(..., is_local=true)` only holds for the rest of the current
        # transaction, not across separate implicit transactions, so the read and the writes
        # below all share one explicit `transaction()` block with set_config as its first
        # statement, rather than being set once and assumed to carry over.
        async with conn.transaction():
            await conn.execute("SELECT set_config('app.tenant_id', $1, true)", tenant_id)

            is_first_member = await conn.fetchval(
                "SELECT count(*) = 0 FROM memberships WHERE tenant_id = $1", tenant_id
            )

            user_id = await conn.fetchval(
                """
                INSERT INTO users (email, display_name, password_hash)
                VALUES ($1, $2, $3)
                RETURNING id
                """,
                body.email,
                body.display_name,
                hash_password(body.password),
            )
            role = "owner" if is_first_member else "member"
            await conn.execute(
                "INSERT INTO memberships (user_id, tenant_id, role) VALUES ($1, $2, $3)",
                user_id,
                tenant_id,
                role,
            )

        token = create_access_token(user_id=str(user_id), tenant_id=tenant_id, role=role)
        return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    async with bootstrap_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, password_hash FROM users WHERE email = $1", body.email
        )
        if user is None or user["password_hash"] is None or not verify_password(
            body.password, user["password_hash"]
        ):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")

        # Same RLS consideration as signup: `memberships` needs `app.tenant_id` set before
        # it can be read at all. Phase 0 has exactly one tenant, so that's unambiguous here;
        # a user with real multi-tenant membership (Phase 2+, PLAN.md §20) will need a
        # tenant-selection step in login instead of this single fixed default.
        async with conn.transaction():
            await conn.execute(
                "SELECT set_config('app.tenant_id', $1, true)", settings.default_tenant_id
            )
            membership = await conn.fetchrow(
                "SELECT tenant_id, role FROM memberships WHERE user_id = $1 LIMIT 1",
                user["id"],
            )
        if membership is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "user has no tenant membership")

        token = create_access_token(
            user_id=str(user["id"]),
            tenant_id=str(membership["tenant_id"]),
            role=membership["role"],
        )
        return TokenResponse(access_token=token)

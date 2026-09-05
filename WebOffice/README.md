# WebOffice

Implementation of PLAN.md's **Phase 0 — Foundations**: single-tenant auth, folder/file CRUD with upload/download, malware scanning on upload, and a Postgres schema with Row-Level Security enforced from day one even though only one tenant exists yet.

Not implemented yet (see PLAN.md for what's next): the collaborative doc editor (Phase 1), real multi-tenancy/self-serve signup (Phase 2), sharing/permissions enforcement beyond tenant isolation (§5 lands once sharing exists), and everything in §16–§34.

## Run it

```bash
cd WebOffice
docker compose up --build
```

First boot: ClamAV downloads its virus database (`freshclam`) before it reports healthy — this can take a few minutes. `api-files` doesn't block startup on it (see docker-compose.yml's `depends_on`); uploads will return `503` until the scanner is ready, then work normally.

Ports are remapped from their defaults in `docker-compose.yml` (5432/9000/9001/8000 were already taken by other local processes on the dev machine this was built on) — adjust back if that's not true for you. Once `api-files` is up (`curl http://localhost:18000/healthz`):

```bash
# 1. Sign up (first signup on this tenant becomes its owner)
curl -s -X POST http://localhost:18000/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"correct horse battery staple","display_name":"Alice"}' \
  | tee /tmp/token.json

TOKEN=$(jq -r .access_token /tmp/token.json)

# 2. Create a folder
curl -s -X POST http://localhost:18000/folders \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Reports"}' | tee /tmp/folder.json

FOLDER_ID=$(jq -r .id /tmp/folder.json)

# 3. Upload a file into it
echo "hello weboffice" > /tmp/hello.txt
curl -s -X POST "http://localhost:18000/files/upload?folder_id=$FOLDER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "upload=@/tmp/hello.txt" | tee /tmp/file.json

FILE_ID=$(jq -r .id /tmp/file.json)

# 4. List the folder's contents
curl -s "http://localhost:18000/folders/$FOLDER_ID" -H "Authorization: Bearer $TOKEN"

# 5. Download it back
curl -s "http://localhost:18000/files/$FILE_ID/download" -H "Authorization: Bearer $TOKEN"
```

Interactive API docs: http://localhost:18000/docs
MinIO console: http://localhost:19001 (user `weboffice` / password `weboffice_dev_secret`)

### Verifying RLS actually isolates tenants (not just app logic)

```bash
docker compose exec postgres psql -U postgres -d weboffice -c "
  INSERT INTO tenants (id, name) VALUES ('00000000-0000-0000-0000-000000000002', 'Other Tenant');
  SET ROLE weboffice_app;
  SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000001', false);
  SELECT count(*) AS tenant_a_sees FROM folders;
  SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000002', false);
  SELECT count(*) AS tenant_b_sees_tenant_a_folders FROM folders;
"
```
The second count must be `0` even though the connection is the unrestricted `weboffice_app` role querying the table directly with no `WHERE tenant_id = ...` clause anywhere — that's Postgres RLS doing the filtering, not application code.

## What's actually enforced right now

- **Tenant isolation** is real: Postgres RLS (`infra/postgres/init/02_roles_rls.sql`), with the app connecting as a non-superuser, non-table-owner role (`weboffice_app`) — the only way RLS policies aren't silently bypassed.
- **Everything else in this Phase 0 build is single-tenant**: every signup joins the one seeded tenant (`03_seed.sql`), and any tenant member can read/write any folder/file in that tenant — the four-role permission model (viewer/commenter/editor/owner, PLAN.md §5) isn't wired into these endpoints yet because there's no sharing surface yet for it to gate.
- **Malware scanning** (§22) runs on every upload via ClamAV's `INSTREAM`, before anything is written to Postgres or MinIO.
- **Optimistic concurrency** (§18) is enforced on folder renames/moves via the `version` column — a stale `PATCH` gets a `409`.
- **Soft delete** (§19) cascades folder deletes to their subtree; there's no retention-purge job yet, so nothing is ever actually removed from S3/Postgres by this code.

See `PLAN.md` for the full architecture and roadmap this implementation is working through.

# WebOffice

Implementation of PLAN.md's **Phase 0 — Foundations** (single-tenant auth, folder/file CRUD with upload/download, malware scanning, Postgres RLS) plus a first vertical slice of **Phase 1 — MVP collaborative editor**: a Hocuspocus/Yjs collab server, a minimal Tiptap-based web frontend, and the four-role permission model (owner/editor/commenter/viewer) actually enforced — both on the document metadata API and on the real-time editing connection itself.

Not implemented yet from Phase 1's full scope (see PLAN.md §11): inline image upload, client-side offline persistence, per-user undo scoping, and share links (email-based sharing to an existing account works; anonymous link sharing doesn't). Also still pending: real multi-tenancy/self-serve signup (Phase 2), folder-level permission UI (the backend already supports folder-inherited grants — see `resolve_file_role` — but nothing in the frontend exercises it yet), and everything in §16–§34.

## Run it

```bash
cd WebOffice
docker compose up --build
```

First boot: ClamAV downloads its virus database (`freshclam`) before it reports healthy — this can take a few minutes. `api-files` doesn't block startup on it (see docker-compose.yml's `depends_on`); uploads will return `503` until the scanner is ready, then work normally.

Ports are remapped to uncommon, non-default host ports in `docker-compose.yml` (5432/9000/9001/8000 are common defaults that tend to collide with other local processes) — adjust if you'd like different values. Once `api-files` is up (`curl http://localhost:48735/healthz`):

```bash
# 1. Sign up (first signup on this tenant becomes its owner)
curl -s -X POST http://localhost:48735/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"correct horse battery staple","display_name":"Alice"}' \
  | tee /tmp/token.json

TOKEN=$(jq -r .access_token /tmp/token.json)

# 2. Create a folder
curl -s -X POST http://localhost:48735/folders \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Reports"}' | tee /tmp/folder.json

FOLDER_ID=$(jq -r .id /tmp/folder.json)

# 3. Upload a file into it
echo "hello weboffice" > /tmp/hello.txt
curl -s -X POST "http://localhost:48735/files/upload?folder_id=$FOLDER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "upload=@/tmp/hello.txt" | tee /tmp/file.json

FILE_ID=$(jq -r .id /tmp/file.json)

# 4. List the folder's contents
curl -s "http://localhost:48735/folders/$FOLDER_ID" -H "Authorization: Bearer $TOKEN"

# 5. Download it back
curl -s "http://localhost:48735/files/$FILE_ID/download" -H "Authorization: Bearer $TOKEN"
```

Interactive API docs: http://localhost:48735/docs
MinIO console: http://localhost:48734 (user `weboffice` / password `weboffice_dev_secret`)

## Phase 1: the collaborative editor

Open http://localhost:48737 in a browser, sign up, and click "New document" — this opens a real-time Tiptap editor backed by Hocuspocus/Yjs (`services/collab-server`). Sign up a second account and use the owner's "Share" button (email + role: `viewer` / `commenter` / `editor`) to grant access; open the same document URL as that second account (a different browser profile, or log out/in) to see edits sync live and the granted role enforced — a `viewer` gets a read-only editor both in the UI and at the collab-server's `onAuthenticate` hook, so it's not just a client-side toggle.

Document content lives in Yjs, not in `files.s3_key`/S3 — the collab server periodically snapshots the Yjs state to MinIO and records it in `doc_snapshots`, so content survives a collab-server restart. `services/web` and `services/collab-server` are bind-mounted into their containers for live-reload during development (see `docker-compose.yml`); edit and the change picks up without a rebuild (Vite HMR for the frontend, a plain process restart needed for `services/collab-server` since its `tsx watch` mode hits Docker Desktop's inotify limit — `docker compose restart collab-server` after editing its source).

### UI stack

`services/web` follows the shadcn/ui approach — Tailwind CSS v4 + unstyled Radix UI primitives (dialog, dropdown menu, select, tooltip, avatar), hand-written and owned in `src/components/ui/` rather than pulled from a component library, styled with lucide-react icons and sonner for toasts. This replaced the original `window.prompt`/`alert`-based Phase 1 UI with real modal dialogs (new document, share with a role picker and a live "people with access" list), a dropdown-based user/document menu, a proper icon toolbar for the editor (bold/italic/headings/lists/quote/code, active-state highlighted), and a presence bar showing colored avatars of everyone currently viewing the document (driven by Yjs awareness state, the same mechanism behind the collaboration cursors).

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
- **Documents (Phase 1) have real per-resource permission enforcement**: `resolve_file_role` (`infra/postgres/init/04_permissions_fn.sql`) resolves owner/direct-grant/folder-inherited access, called from both api-files (`GET/POST /documents/*`) and collab-server (`onAuthenticate`) — a user with no grant gets 404 from the API and a rejected websocket connection from the collab server; a `viewer`/`commenter` grant gets a connection that's server-side read-only (`connectionConfig.readOnly`), not just a disabled button in the UI.
- **Everything else — folders and plain file upload/download (Phase 0) — is still single-tenant with no per-resource checks**: every signup joins the one seeded tenant (`03_seed.sql`), and any tenant member can read/write any folder/file in that tenant. Only documents (the Phase 1 resource type) go through `resolve_file_role`.
- **Malware scanning** (§22) runs on every upload via ClamAV's `INSTREAM`, before anything is written to Postgres or MinIO.
- **Optimistic concurrency** (§18) is enforced on folder renames/moves via the `version` column — a stale `PATCH` gets a `409`.
- **Soft delete** (§19) cascades folder deletes to their subtree; there's no retention-purge job yet, so nothing is ever actually removed from S3/Postgres by this code.

See `PLAN.md` for the full architecture and roadmap this implementation is working through.

import { Server } from "@hocuspocus/server";
import * as Y from "yjs";

import { verifyToken } from "./auth";
import { env } from "./config";
import { withTenant } from "./db";
import { getObject, putObject } from "./storage";

// documentName convention: `${tenantId}:${fileId}` (PLAN.md §7/§9), so a
// tenant's documents live in their own namespace even on a shared server.
interface DocContext {
  userId: string;
  tenantId: string;
  fileId: string;
  role: string;
}

const READ_ONLY_ROLES = new Set(["viewer", "commenter"]);

const server = new Server<DocContext>({
  port: env.port,

  async onAuthenticate({ token, documentName, connectionConfig }) {
    if (!token) throw new Error("unauthorized: missing token");

    const [tenantId, fileId] = documentName.split(":");
    if (!tenantId || !fileId) throw new Error("unauthorized: malformed document name");

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new Error("unauthorized: invalid token");
    }
    if (payload.tenant_id !== tenantId) throw new Error("unauthorized: tenant mismatch");

    // Same access rule api-files uses (infra/postgres/init/04_permissions_fn.sql),
    // called here rather than reimplemented, so the two services can't drift.
    const role = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ role: string | null }>(
        "SELECT resolve_file_role($1, $2) AS role",
        [fileId, payload!.sub],
      );
      return rows[0]?.role ?? null;
    });
    if (!role) throw new Error("forbidden: no access to this document");

    if (READ_ONLY_ROLES.has(role)) {
      connectionConfig.readOnly = true;
    }

    const context: DocContext = { userId: payload.sub, tenantId, fileId, role };
    return context;
  },

  async onLoadDocument({ context, document }) {
    const snapshot = await withTenant(context.tenantId, async (client) => {
      const { rows } = await client.query<{ yjs_state_s3_key: string }>(
        "SELECT yjs_state_s3_key FROM doc_snapshots WHERE file_id = $1 ORDER BY created_at DESC LIMIT 1",
        [context.fileId],
      );
      return rows[0] ?? null;
    });
    if (snapshot) {
      const update = await getObject(snapshot.yjs_state_s3_key);
      Y.applyUpdate(document, update);
    }
    return document;
  },

  // Debounced by Hocuspocus itself (a few seconds of inactivity) — not called
  // on every keystroke. Hocuspocus passes the connection's context back as
  // `lastContext` here, not `context` (that field only exists on hooks tied
  // to a live connection, e.g. onLoadDocument).
  async onStoreDocument({ document, lastContext: context }) {
    const update = Y.encodeStateAsUpdate(document);
    const key = `${context.tenantId}/${context.fileId}/snapshots/${Date.now()}.bin`;
    await putObject(key, Buffer.from(update), "application/octet-stream");
    await withTenant(context.tenantId, async (client) => {
      await client.query(
        "INSERT INTO doc_snapshots (tenant_id, file_id, yjs_state_s3_key, size_bytes) VALUES ($1, $2, $3, $4)",
        [context.tenantId, context.fileId, key, update.byteLength],
      );
      await client.query("UPDATE files SET updated_at = now() WHERE id = $1", [context.fileId]);
    });
  },
});

server.listen();

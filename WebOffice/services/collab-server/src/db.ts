import { Pool, type PoolClient } from "pg";

import { env } from "./config";

const pool = new Pool({ connectionString: env.databaseUrl });

// Mirrors services/api-files/app/db.py's tenant_connection: `set_config(...,
// is_local=true)` only holds for the rest of the current transaction, so it
// has to be the first statement inside the same explicit transaction as every
// RLS-protected read/write that follows it in `fn`.
export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

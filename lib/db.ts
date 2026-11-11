import { Pool, type PoolClient } from "pg";

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
// libpq accepts `sslrootcert=system`; node-postgres otherwise treats "system"
// as a file path. Use Node's trusted CA bundle and preserve hostname verification.
const systemCa = url?.searchParams.get("sslrootcert") === "system";
if (systemCa) ["sslrootcert", "sslmode"].forEach((p) => url.searchParams.delete(p));

export const db = new Pool({
  connectionString: url?.toString(),
  ...(systemCa && { ssl: { rejectUnauthorized: true } }),
  max: 3,
  connectionTimeoutMillis: 10_000,
});

export const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === "23505";

/** Runs `fn` while holding a session advisory lock on `key`, or returns `busy()` if it is taken. */
export async function withLock<T>(key: string, busy: () => T, fn: (c: PoolClient) => Promise<T>) {
  const c = await db.connect();
  let locked = false;
  try {
    ({ locked } = (
      await c.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked",
        [key],
      )
    ).rows[0]);
    return locked ? await fn(c) : busy();
  } finally {
    try {
      if (locked) await c.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [key]);
      c.release();
    } catch {
      c.release(true); // Dropping the session releases its locks.
    }
  }
}

/** Runs `fn` in a transaction, rolling back on error. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>) {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/** Locks a bucket name for this transaction; returns an error if the name is retired. */
export async function reserveName(c: PoolClient, bucket: string) {
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`bucket:${bucket}`]);
  return (await c.query("SELECT 1 FROM retired_bucket_names WHERE name=$1", [bucket])).rowCount
    ? "This bucket name has been retired and cannot be reused."
    : null;
}

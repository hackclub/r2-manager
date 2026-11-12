import "server-only";
import { getAccess } from "./access";
import { cf, cloudflareBuckets, r2 } from "./cloudflare";
import type { PoolClient } from "pg";
import { db, withLock } from "./db";

export async function ownedActiveBucket(owner: string, name: string) {
  const a = await getAccess();
  if (a?.user.id === owner && a.admin)
    return (await cloudflareBuckets()).some((b) => b.name === name);
  const r = await db.query(
    "SELECT 1 FROM managed_buckets WHERE EXISTS (SELECT 1 FROM bucket_members m WHERE m.bucket_name=managed_buckets.name AND m.user_id=$1) AND name = $2 AND status = 'active'",
    [owner, name],
  );
  return r.rows.length === 1;
}

/** The caller's access when they may use `bucket`, else null. */
export async function bucketAccess(bucket: unknown) {
  const a = await getAccess();
  return a?.allowed && typeof bucket === "string" && (await ownedActiveBucket(a.user.id, bucket))
    ? a
    : null;
}

type ObjectEntry = {
  key: string;
  size: number;
  last_modified?: string;
  storage_class?: string;
  http_metadata?: { contentType?: string };
};

export async function listObjects(
  bucket: string,
  prefix: string,
  cursor?: string,
  asFolders = true,
) {
  const q = new URLSearchParams({
    prefix,
    per_page: "100",
    ...(asFolders && { delimiter: "/" }),
    ...(cursor && { cursor }),
  });
  const { ok, data } = await cf(`${r2(bucket, "/objects")}?${q}`);
  if (!ok || !Array.isArray(data.result)) throw new Error("Unable to load objects from Cloudflare");
  const info = data.result_info;
  return {
    objects: data.result as ObjectEntry[],
    folders: (info?.delimited ?? []) as string[],
    cursor: info?.is_truncated ? (info.cursor as string) : undefined,
  };
}

/** Runs `fn` under the bucket's advisory lock once the caller is confirmed to manage it. Admins may pass `unmanaged`. */
export async function withBucket<T>(
  bucket: string,
  fn: (c: PoolClient) => Promise<T>,
  unmanaged = false,
) {
  const a = await getAccess();
  if (!a?.allowed) return "Bucket not found.";
  return withLock<T | string>(
    `bucket:${bucket}`,
    () => "Another bucket operation is in progress. Try again.",
    async (c) =>
      (
        await c.query(
          "SELECT 1 FROM managed_buckets WHERE name=$1 AND (EXISTS (SELECT 1 FROM bucket_members m WHERE m.bucket_name=managed_buckets.name AND m.user_id=$2) OR $3) AND status='active'",
          [bucket, a.user.id, a.admin],
        )
      ).rowCount ||
      (unmanaged && a.admin)
        ? fn(c)
        : "Bucket not found.",
  );
}

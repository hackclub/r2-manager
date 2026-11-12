import "server-only";
import { getAccess, type Access } from "./access";
import { cf, cloudflareBuckets, r2 } from "./cloudflare";
import type { PoolClient } from "pg";
import { db, withLock } from "./db";
import { hasBucketRole, bucketRoles, type BucketRole } from "./bucket-policy";

export async function bucketRole(a: Access, bucket: string): Promise<BucketRole | undefined> {
  if (!a.allowed) return;
  if (a.admin)
    return (await cloudflareBuckets()).some((b) => b.name === bucket) ? "manager" : undefined;
  const r = await db.query<{ role: BucketRole }>(
    "SELECT m.role FROM managed_buckets b JOIN bucket_members m ON m.bucket_name=b.name WHERE m.user_id=$1 AND b.name=$2 AND b.status='active'",
    [a.user.id, bucket],
  );
  return r.rows[0]?.role;
}

/** Recheck permissions at every server entry point; never rely on hidden UI controls. */
export async function bucketAccess(bucket: unknown, required: BucketRole = "viewer") {
  const a = await getAccess();
  if (!a || typeof bucket !== "string") return null;
  const role = await bucketRole(a, bucket);
  return hasBucketRole(role, required) ? { ...a, role } : null;
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
  required: BucketRole = "manager",
) {
  const a = await getAccess();
  if (!a?.allowed) return "Bucket not found.";
  return withLock<T | string>(
    `bucket:${bucket}`,
    () => "Another bucket operation is in progress. Try again.",
    async (c) =>
      (
        await c.query(
          "SELECT 1 FROM managed_buckets WHERE name=$1 AND (EXISTS (SELECT 1 FROM bucket_members m WHERE m.bucket_name=managed_buckets.name AND m.user_id=$2 AND m.role=ANY($4::text[])) OR $3) AND status='active'",
          [
            bucket,
            a.user.id,
            a.admin,
            Object.keys(bucketRoles).filter((role) => hasBucketRole(role, required)),
          ],
        )
      ).rowCount ||
      (unmanaged && a.admin)
        ? fn(c)
        : "Bucket not found.",
  );
}

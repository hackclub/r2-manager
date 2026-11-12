import "server-only";
import { cache } from "react";
import type { Access } from "./access";
import type { BucketRole } from "./bucket-policy";
import { cf, cloudflareBuckets, cloudflareConfigured, r2 } from "./cloudflare";
import { db, isUniqueViolation, reserveName, tx } from "./db";
import { bucketName, locations, storageClasses } from "./format";

export const listBuckets = cache(async function listBuckets({ user, admin }: Access) {
  const { rows } = await db.query<{
    name: string;
    status: string;
    created_at: Date;
    role: BucketRole;
  }>(
    "SELECT b.name, b.status, b.created_at, CASE WHEN $2 THEN 'manager' ELSE m.role END AS role FROM managed_buckets b LEFT JOIN bucket_members m ON m.bucket_name=b.name AND m.user_id=$1 WHERE m.user_id IS NOT NULL OR $2 ORDER BY b.created_at DESC",
    [user.id, admin],
  );
  if (!admin) return rows;
  const known = new Set(rows.map((b) => b.name));
  return [
    ...rows,
    ...(await cloudflareBuckets())
      .filter((b) => !known.has(b.name))
      .map((b) => ({
        name: b.name,
        status: "unassigned",
        created_at: new Date(b.creation_date),
        role: "manager" as const,
      })),
  ];
});

const unconfirmed = "Creation could not be confirmed. Contact the administrator before retrying.";

export async function createBucket(
  owner: string,
  name: string,
  location: string,
  storageClass: string,
) {
  if (
    (location && !Object.hasOwn(locations, location)) ||
    !Object.hasOwn(storageClasses, storageClass)
  )
    return "Invalid bucket settings.";
  if (!bucketName.test(name))
    return "Use 3–63 lowercase letters, numbers, or hyphens; start and end with a letter or number.";
  if (!cloudflareConfigured()) return "R2 is not configured. Contact the administrator.";
  try {
    const error = await tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [owner]);
      const error = await reserveName(c, name);
      if (error) return error;
      await c.query(
        "INSERT INTO managed_buckets (name, owner_id, status) VALUES ($1, $2, 'pending')",
        [name, owner],
      );
      await c.query(
        "INSERT INTO bucket_members(bucket_name,user_id,role) VALUES($1,$2,'manager')",
        [name, owner],
      );
    });
    if (error) return error;
  } catch (e) {
    if (isUniqueViolation(e)) return "This bucket name is already in use.";
    throw e;
  }
  try {
    const { res, ok } = await cf(r2(), {
      method: "POST",
      body: JSON.stringify({ name, storageClass, ...(location && { locationHint: location }) }),
    });
    if (!ok) {
      // A received rejection is definitive; transport failures keep the reservation for review.
      if (res.status < 400 || res.status >= 500) return unconfirmed;
      await db.query(
        "DELETE FROM managed_buckets WHERE name = $1 AND owner_id = $2 AND status = 'pending'",
        [name, owner],
      );
      return "Cloudflare could not create this bucket. Check the name and try again.";
    }
    await db.query(
      "UPDATE managed_buckets SET status = 'active' WHERE name = $1 AND owner_id = $2",
      [name, owner],
    );
  } catch {
    return unconfirmed;
  }
  // This is a newly created bucket, so it cannot have an existing CORS policy.
  // Allow only this app's configured origin to PUT presigned uploads.
  try {
    const origin = new URL(process.env.BETTER_AUTH_URL || "").origin;
    const { ok } = await cf(r2(name, "/cors"), {
      method: "PUT",
      body: JSON.stringify({
        rules: [{ allowed: { origins: [origin], methods: ["PUT"], headers: ["content-type"] } }],
      }),
    });
    if (!ok) throw new Error("CORS setup failed");
    return null;
  } catch {
    return "Bucket created, but browser upload setup failed. Contact the administrator.";
  }
}

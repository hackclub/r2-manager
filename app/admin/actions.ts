"use server";
import { revalidatePath } from "next/cache";
import { getAccess } from "@/lib/access";
import { db, reserveName, tx } from "@/lib/db";
import { cloudflareBuckets } from "@/lib/cloudflare";
import { revokeKeysAndBlockSubject, removeBucketMember } from "@/lib/api-keys";

const denied = "Administrator access required.";
const protectedAdmin = "Administrator access cannot be revoked here.";

export async function allowUser(_: string | null, form: FormData) {
  if (!(await getAccess())?.admin) return denied;
  const [raw, allowed] = [form.get("subject"), form.get("allowed")];
  const subject = typeof raw === "string" ? raw.trim() : "";
  if (!subject || (raw as string).length > 200 || (allowed !== "true" && allowed !== "false"))
    return "Enter a valid Hack Club Auth ID.";
  try {
    if (allowed === "false")
      return (await revokeKeysAndBlockSubject(subject))
        ? "Access revoked and API keys disabled."
        : protectedAdmin;
    const { rowCount } = await db.query(
      "INSERT INTO app_access(subject,allowed) VALUES($1,true) ON CONFLICT(subject) DO UPDATE SET allowed=EXCLUDED.allowed WHERE NOT app_access.admin RETURNING subject",
      [subject],
    );
    return rowCount ? "Access updated." : protectedAdmin;
  } catch (e) {
    if (allowed === "true") throw e;
    return "Could not revoke this user's API keys. Access was not changed. Please retry after checking Cloudflare.";
  } finally {
    revalidatePath("/", "layout");
  }
}

export async function promoteUser(subject: unknown) {
  if (!(await getAccess())?.admin) return denied;
  if (typeof subject !== "string" || !subject.trim() || subject.length > 200)
    return "Enter a valid Hack Club Auth ID.";
  await db.query(
    "INSERT INTO app_access(subject,allowed,admin) VALUES($1,true,true) ON CONFLICT(subject) DO UPDATE SET allowed=true,admin=true",
    [subject.trim()],
  );
  revalidatePath("/", "layout");
  return null;
}

export async function assignBucket(_: string | null, form: FormData) {
  if (!(await getAccess())?.admin) return denied;
  const [bucket, owner] = [form.get("bucket"), form.get("owner")];
  if (typeof bucket !== "string" || typeof owner !== "string") return "Choose a bucket and person.";
  const found = (await cloudflareBuckets()).find((b) => b.name === bucket);
  if (!found) return "This bucket is no longer in Cloudflare.";
  try {
    return await tx(async (c) => {
      if (!(await c.query('SELECT 1 FROM "user" WHERE id=$1', [owner])).rowCount)
        return "This person must sign in once first.";
      const retired = await reserveName(c, bucket);
      if (retired) return retired;
      const { rowCount } = await c.query(
        "INSERT INTO managed_buckets(name,owner_id,status,created_at) VALUES($1,$2,'active',$3) ON CONFLICT(name) DO NOTHING RETURNING name",
        [bucket, owner, found.creation_date],
      );
      if (
        !rowCount &&
        !(
          await c.query("SELECT 1 FROM managed_buckets WHERE name=$1 AND status='active'", [bucket])
        ).rowCount
      )
        return "This bucket has a pending reservation.";
      const added = await c.query(
        "INSERT INTO bucket_members(bucket_name,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING user_id",
        [bucket, owner],
      );
      revalidatePath("/", "layout");
      return added.rowCount ? "Access granted." : "This person already has access.";
    });
  } catch {
    return "Unable to assign this bucket. Try again.";
  }
}

export async function removeBucketAccess(bucket: string, user: string) {
  if (!(await getAccess())?.admin) return denied;
  if (typeof bucket !== "string" || typeof user !== "string") return "Choose a bucket and person.";
  try {
    await removeBucketMember(bucket, user);
    return null;
  } catch {
    return "Could not revoke this person's API keys. Bucket access was not removed. Check Cloudflare and retry.";
  } finally {
    revalidatePath("/", "layout");
  }
}

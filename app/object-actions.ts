"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bucketAccess, withBucket } from "@/lib/objects";
import {
  hasMultipartUploads,
  maxUploadSize,
  objectUrl,
  putFolder,
  removeObject,
  validObjectKey,
} from "@/lib/s3";
import { bucketSetting, cf, cloudflareConfigured, r2 } from "@/lib/cloudflare";
import { jobState } from "@/lib/format";

export async function createUploadUrl(bucket: string, key: string, size: number) {
  if (!(await bucketAccess(bucket, "editor")) || typeof key !== "string")
    return { error: "Bucket not found." };
  if (!validObjectKey(key)) return { error: "Invalid object name." };
  if (!Number.isSafeInteger(size) || size < 0 || size > maxUploadSize)
    return { error: "Files must be 300 MB or smaller." };
  try {
    return { url: await objectUrl(bucket, key, "put", { size }) };
  } catch {
    return { error: "Unable to prepare upload. Contact the administrator." };
  }
}

export async function deleteBucket(_: string | null, form: FormData): Promise<string | null> {
  const bucket = form.get("bucket");
  if (typeof bucket !== "string" || form.get("confirmation") !== bucket)
    return "Enter the bucket name to confirm.";
  if (!cloudflareConfigured()) return "R2 is not configured.";
  const error = await withBucket(bucket, async (c) => {
    if (
      (await c.query("SELECT 1 FROM managed_domains WHERE bucket_name=$1 LIMIT 1", [bucket]))
        .rowCount
    )
      return "Disconnect or resolve this bucket's custom domains before deleting it.";
    try {
      const { domains } = await bucketSetting<{ domains?: unknown[] }>(bucket, "/domains/custom");
      if (!Array.isArray(domains) || domains.length)
        return "Disconnect this bucket's custom domains before deleting it.";
    } catch {
      return "Could not verify custom domains. Try again before deleting the bucket.";
    }
    await c.query(
      "INSERT INTO retired_bucket_names(name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
      [bucket],
    );
    try {
      if (!(await cf(r2(bucket), { method: "DELETE" })).ok)
        return "Cloudflare could not delete the bucket. It must be empty and have no pending uploads or event notification rules.";
    } catch {
      return "Deletion could not be confirmed. Check the bucket before retrying.";
    }
    await c.query("DELETE FROM managed_buckets WHERE name=$1", [bucket]);
  });
  if (error) return error;
  revalidatePath("/", "layout");
  return redirect("/");
}

/** Runs a single-object operation, revalidating the bucket on success. */
async function objectOp(bucket: string, op: () => Promise<unknown>, failed: string) {
  try {
    await op();
    revalidatePath(`/buckets/${bucket}`);
    return null;
  } catch {
    return failed;
  }
}

export async function deleteObject(bucket: string, key: string) {
  if (!(await bucketAccess(bucket, "editor")) || typeof key !== "string" || !validObjectKey(key))
    return "Object not found.";
  return objectOp(bucket, () => removeObject(bucket, key), "Could not delete the object.");
}

export async function createFolder(bucket: string, prefix: string, name: string) {
  if (
    !(await bucketAccess(bucket, "editor")) ||
    typeof prefix !== "string" ||
    typeof name !== "string"
  )
    return "Bucket not found.";
  if (!name || name.includes("/") || (prefix && !prefix.endsWith("/")))
    return "Enter a folder name without slashes.";
  const key = `${prefix}${name}/`;
  if (!validObjectKey(key)) return "Invalid folder name.";
  return objectOp(bucket, () => putFolder(bucket, key), "Could not create folder.");
}

export type EmptyBucketResult = {
  state: "completed" | "running" | "error";
  message: string;
  jobId?: string;
};

export async function emptyBucket(
  _: EmptyBucketResult | null,
  form: FormData,
): Promise<EmptyBucketResult> {
  const bucket = form.get("bucket");
  if (!(await bucketAccess(bucket, "manager")))
    return { state: "error", message: "Bucket not found." };
  if (form.get("confirmation") !== `EMPTY ${bucket}`)
    return { state: "error", message: "Type the confirmation exactly as shown." };
  const b = bucket as string;
  try {
    if (await hasMultipartUploads(b))
      return {
        state: "error",
        message: "Abort in-progress multipart uploads before emptying the bucket.",
      };
    const { status, id: jobId } = await bucketSetting<{ status: string; id: string }>(b, "/jobs", {
      method: "POST",
      body: JSON.stringify({ jobType: "prefixDelete", prefix: "" }),
    });
    revalidatePath(`/buckets/${b}/settings`);
    const s = jobState(status);
    return s === "completed"
      ? { state: "completed", message: "Emptying job completed.", jobId }
      : s === "failed"
        ? {
            state: "error",
            message: "The emptying job did not complete. Check its status below.",
            jobId,
          }
        : { state: "running", message: "Emptying bucket…", jobId };
  } catch {
    return {
      state: "error",
      message: "Could not start or confirm the emptying job. Check the job list before retrying.",
    };
  }
}

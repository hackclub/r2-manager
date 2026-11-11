"use server";
import { bucketHref } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { createBucket } from "@/lib/buckets";

export async function createBucketAction(_: string | null, form: FormData): Promise<string | null> {
  const a = await getAccess();
  if (!a?.allowed) return "You do not have access to create buckets.";
  const [name, location, storageClass] = ["name", "location", "storageClass"].map((k) =>
    form.get(k),
  );
  if (typeof name !== "string") return "Enter a bucket name.";
  if (typeof location !== "string" || typeof storageClass !== "string")
    return "Select bucket settings.";
  const error = await createBucket(a.user.id, name, location, storageClass);
  revalidatePath("/", "layout");
  return error ?? redirect(bucketHref(name));
}

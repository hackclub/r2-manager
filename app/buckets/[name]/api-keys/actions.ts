"use server";
import { getAccess } from "@/lib/access";
import { parseKeyRequest, isKeyId } from "@/lib/api-key-policy";
import { issueKey, revokeOwnedKey, rollOwnedKey, type IssuedCredentials } from "@/lib/api-keys";
import { revalidatePath } from "next/cache";

type CreateKeyResult = { credentials?: IssuedCredentials; error?: string };
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const refresh = () => {
  revalidatePath("/buckets/[name]/api-keys", "page");
  revalidatePath("/api-keys");
};

export async function createApiKey(
  _: CreateKeyResult | null,
  form: FormData,
): Promise<CreateKeyResult> {
  const a = await getAccess();
  if (!a?.allowed || !a.subject)
    return { error: "Sign in with an approved account to create API keys." };
  try {
    return { credentials: await issueKey(a.user.id, a.subject, parseKeyRequest(form)) };
  } catch (e) {
    return { error: message(e, "Unable to create API key.") };
  } finally {
    refresh();
  }
}

export async function revokeApiKey(id: string) {
  const a = await getAccess();
  if (!a?.allowed) return "Sign in with an approved account to manage API keys.";
  if (!isKeyId(id)) return "Key not found.";
  try {
    await revokeOwnedKey(a.user.id, id);
    return null;
  } catch (e) {
    return message(e, "Unable to revoke key. Try again.");
  } finally {
    refresh();
  }
}

export async function rollApiKey(id: string): Promise<CreateKeyResult> {
  const a = await getAccess();
  if (!a?.allowed || !a.subject)
    return { error: "Sign in with an approved account to manage API keys." };
  if (!isKeyId(id)) return { error: "Key not found." };
  try {
    return { credentials: await rollOwnedKey(a.user.id, a.subject, id) };
  } catch (e) {
    return { error: message(e, "Unable to roll key. Try again.") };
  }
}

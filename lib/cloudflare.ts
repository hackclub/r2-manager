import "server-only";
import { cache } from "react";

export const account = process.env.CLOUDFLARE_ACCOUNT_ID;
/** The single Cloudflare API token used for every Cloudflare call, including R2 S3 access. */
export const apiToken = process.env.CLOUDFLARE_API_TOKEN;
export const cloudflareConfigured = () => !!(account && apiToken);
export const r2Endpoint = `https://${account}.r2.cloudflarestorage.com`;
const api = "https://api.cloudflare.com/client/v4/";
type Json = any;

export async function cf(path: string, init?: RequestInit) {
  if (!cloudflareConfigured()) throw new Error("Cloudflare is not configured.");
  const res = await fetch(api + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data: Json = await res.json().catch(() => null);
  return { res, data, ok: res.ok && data?.success === true };
}

export const r2 = (bucket = "", suffix = "") =>
  `accounts/${encodeURIComponent(account!)}/r2/buckets${bucket && `/${encodeURIComponent(bucket)}`}${suffix}`;

export async function bucketSetting<T>(
  bucket: string,
  suffix: string,
  init?: RequestInit,
): Promise<T> {
  const { res, ok, data } = await cf(r2(bucket, suffix), init);
  if (
    suffix === "/cors" &&
    (!init?.method || init.method === "GET") &&
    res.status === 404 &&
    data?.errors?.some((error: { code?: number }) => error.code === 10059)
  )
    return { rules: [] } as T;
  if (!ok) throw new Error(data?.errors?.[0]?.message || "Cloudflare request failed");
  return data.result;
}

/** Returns the account node of a GraphQL Analytics query, or null when unavailable. */
export async function graphql(query: string, variables: Record<string, unknown>, timeout = 20000) {
  try {
    const { res, data } = await cf("graphql", {
      method: "POST",
      body: JSON.stringify({ query, variables: { account, ...variables } }),
      signal: AbortSignal.timeout(timeout),
    });
    return res.ok && !data?.errors?.length
      ? ((data?.data?.viewer?.accounts?.[0] as Json) ?? null)
      : null;
  } catch {
    return null;
  }
}

export const cloudflareBuckets = cache(async () => {
  const buckets: { name: string; creation_date: string }[] = [];
  const seen = new Set<string>();
  let cursor = "";
  do {
    const q = new URLSearchParams({ per_page: "1000", ...(cursor && { cursor }) });
    const { ok, data } = await cf(`${r2()}?${q}`);
    if (!ok || !Array.isArray(data.result?.buckets))
      throw new Error("Unable to load Cloudflare buckets.");
    buckets.push(...data.result.buckets);
    cursor = data.result_info?.cursor || "";
    if (cursor && seen.has(cursor))
      throw new Error("Cloudflare returned a repeated pagination cursor.");
    seen.add(cursor);
  } while (cursor);
  return buckets;
});

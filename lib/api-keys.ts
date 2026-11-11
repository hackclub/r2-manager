import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { db, withLock } from "./db";
import { accessAllowed } from "./access-policy";
import { tokenPolicy, type KeyRequest } from "./api-key-policy";
import { account, cf, cloudflareConfigured, r2Endpoint } from "./cloudflare";

export type KeyRow = {
  id: string;
  owner_id: string;
  name: string;
  permission: "read" | "read-write";
  buckets: string[];
  cloudflare_id: string | null;
  status: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
};
export type KeySummary = Omit<KeyRow, "owner_id" | "created_at" | "expires_at" | "revoked_at"> & {
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};
export type IssuedCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  expiresAt: string;
  buckets: string[];
  permission: "read" | "read-write";
  name: string;
};
type Token = {
  id: string;
  name: string;
  value?: string;
  expires_on?: string;
  policies?: ReturnType<typeof tokenPolicy>;
};
class CloudflareError extends Error {
  constructor(
    message: string,
    readonly definitive = false,
  ) {
    super(message);
  }
}
const remoteName = (k: Pick<KeyRow, "id" | "name">) => `R2M / ${k.id.slice(0, 8)} / ${k.name}`;
const tokens = (suffix: string, init?: RequestInit) =>
  cf(`accounts/${account}/tokens${suffix}`, { ...init, signal: AbortSignal.timeout(20000) });

async function tokenRequest<T>(suffix: string, init?: RequestInit): Promise<T> {
  if (!cloudflareConfigured())
    throw new CloudflareError(
      "API key creation is not configured. Contact the administrator.",
      true,
    );
  const { res, data, ok } = await tokens(suffix, init);
  if (!ok)
    throw new CloudflareError(
      res.status === 403
        ? "Cloudflare has not granted token-management access. Contact the administrator."
        : "Cloudflare could not complete the key operation. Try again.",
      res.status >= 400 && res.status < 500,
    );
  return data.result;
}

const withOwnerLock = <T>(owner: string, fn: (c: PoolClient) => Promise<T>) =>
  withLock(
    `api-key-owner:${owner}`,
    () => {
      throw new Error("Another key operation is in progress. Please try again in a moment.");
    },
    fn,
  );

const sorted = (o: object) => JSON.stringify(Object.entries(o).sort());
/** Whether Cloudflare's token has exactly the expected scope. */
const samePolicy = (t: Token, [e]: ReturnType<typeof tokenPolicy>) => {
  const p = t.policies?.length === 1 ? t.policies[0] : undefined;
  const ids = (x: typeof e) => JSON.stringify(x.permission_groups.map((g) => g.id).sort());
  return p?.effect === "allow" && ids(p) === ids(e) && sorted(p.resources) === sorted(e.resources);
};
const credentials = (
  k: Pick<KeyRow, "name" | "permission" | "buckets">,
  id: string,
  secret: string,
  expires: Date,
) => ({
  name: k.name,
  permission: k.permission,
  buckets: k.buckets,
  accessKeyId: id,
  secretAccessKey: createHash("sha256").update(secret).digest("hex"),
  endpoint: r2Endpoint,
  region: "auto",
  expiresAt: expires.toISOString(),
});

export async function ownedKeyBuckets(owner: string, q: Pick<PoolClient, "query"> = db) {
  const { rows } = await q.query<{ name: string }>(
    "SELECT name FROM managed_buckets WHERE owner_id=$1 AND status='active' ORDER BY name",
    [owner],
  );
  return rows.map((b) => b.name);
}

export async function listOwnedKeys(owner: string): Promise<KeySummary[]> {
  const { rows } = await db.query<KeyRow>(
    "SELECT * FROM managed_api_keys WHERE owner_id=$1 ORDER BY created_at DESC",
    [owner],
  );
  return rows.map(({ owner_id: _owner, created_at, expires_at, revoked_at, ...k }) => ({
    ...k,
    created_at: created_at.toISOString(),
    expires_at: expires_at.toISOString(),
    revoked_at: revoked_at?.toISOString() || null,
  }));
}

async function requireKeyAccess(c: PoolClient, owner: string, subject: string) {
  const {
    rows: [u],
  } = await c.query<{
    email: string;
    emailVerified: boolean;
    allowed: boolean | null;
    admin: boolean | null;
  }>(
    `SELECT u.email,u."emailVerified",p.allowed,p.admin FROM "user" u
       JOIN account a ON a."userId"=u.id AND a."providerId"='hackclub' AND a."accountId"=$2
       LEFT JOIN app_access p ON p.subject=a."accountId" WHERE u.id=$1`,
    [owner, subject],
  );
  const entry = u?.allowed == null ? undefined : { allowed: u.allowed, admin: u.admin === true };
  if (!u || !accessAllowed(subject, u, entry))
    throw new Error("Your account no longer has access.");
}

export const issueKey = (
  owner: string,
  subject: string,
  request: KeyRequest,
): Promise<IssuedCredentials> =>
  withOwnerLock(owner, async (c) => {
    // Recheck permission after acquiring the same lock used by access revocation.
    await requireKeyAccess(c, owner, subject);
    let reserved = false;
    let created: Token | undefined;
    try {
      await c.query("BEGIN");
      const owned = await c.query(
        "SELECT name FROM managed_buckets WHERE owner_id=$1 AND status='active' AND name=ANY($2::text[]) FOR UPDATE",
        [owner, request.buckets],
      );
      if (owned.rows.length !== request.buckets.length)
        throw new Error(
          "Keys can only include active buckets assigned to you. Refresh the page and check your selection.",
        );
      const inserted = await c.query(
        "INSERT INTO managed_api_keys(id,owner_id,name,permission,buckets,expires_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,permission=EXCLUDED.permission,buckets=EXCLUDED.buckets,expires_at=EXCLUDED.expires_at,created_at=now(),status='pending',cloudflare_id=NULL,revoked_at=NULL WHERE managed_api_keys.owner_id=EXCLUDED.owner_id AND managed_api_keys.status='failed' RETURNING id",
        [request.id, owner, request.name, request.permission, request.buckets, request.expiresAt],
      );
      if (!inserted.rowCount)
        throw new Error(
          "This key request has already been processed. Check your key list before creating another.",
        );
      await c.query("COMMIT");
      reserved = true;
      const policies = tokenPolicy(account!, request.buckets, request.permission);
      created = await tokenRequest<Token>("", {
        method: "POST",
        body: JSON.stringify({
          name: remoteName(request),
          policies,
          expires_on: request.expiresAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
        }),
      });
      // Verify Cloudflare did not expand the requested scope or expiration before revealing a secret.
      const expires = Date.parse(created.expires_on || "");
      if (
        !created.id ||
        !created.value ||
        !samePolicy(created, policies) ||
        !(expires <= request.expiresAt.getTime() && expires > Date.now())
      )
        throw new Error(
          "Cloudflare returned a key with unexpected scope or expiry. The key was not released.",
        );
      await c.query(
        "UPDATE managed_api_keys SET cloudflare_id=$1,status='active',expires_at=$2 WHERE id=$3 AND owner_id=$4",
        [created.id, new Date(expires), request.id, owner],
      );
      return credentials(request, created.id, created.value, new Date(expires));
    } catch (error) {
      await c.query("ROLLBACK").catch(() => {});
      if (reserved) {
        let safe = error instanceof CloudflareError && error.definitive;
        if (created?.id) {
          try {
            await tokenRequest(`/${encodeURIComponent(created.id)}`, { method: "DELETE" });
            safe = true;
          } catch {
            /* The pending record can be reconciled by its deterministic remote name. */
          }
        }
        await c
          .query(
            "UPDATE managed_api_keys SET status=$1,cloudflare_id=COALESCE($2,cloudflare_id) WHERE id=$3 AND owner_id=$4",
            [safe ? "failed" : "pending", created?.id || null, request.id, owner],
          )
          .catch(() => {});
      }
      throw new Error(error instanceof Error ? error.message : "Unable to create API key.");
    }
  });

async function findRemoteKey(key: KeyRow) {
  if (key.cloudflare_id) return key.cloudflare_id;
  // Recover an indeterminate create without ever persisting or re-showing its secret.
  const matches = new Set<string>();
  const names = [remoteName(key), `R2 Manager / ${key.id} / ${key.name}`];
  for (let page = 1; ; page++) {
    const { ok, data } = await tokens(`?per_page=50&page=${page}`);
    if (!ok || !Array.isArray(data.result))
      throw new Error(
        "Could not check whether this key exists in Cloudflare. Try revoking it again.",
      );
    for (const t of data.result as Token[]) if (names.includes(t.name)) matches.add(t.id);
    if (matches.size > 1)
      throw new Error(
        "Multiple Cloudflare tokens match this key. Ask an administrator to reconcile it before revoking.",
      );
    if (page >= (data.result_info?.total_pages || 1)) return matches.values().next().value || null;
  }
}

async function revokeRow(c: PoolClient, key: KeyRow) {
  const id = await findRemoteKey(key);
  await c.query(
    "UPDATE managed_api_keys SET status='revoke_pending',cloudflare_id=COALESCE($1,cloudflare_id) WHERE id=$2",
    [id, key.id],
  );
  if (id) {
    const path = `/${encodeURIComponent(id)}`;
    // A previously revoked/expired token may already have been deleted in Cloudflare.
    try {
      await tokenRequest(path, { method: "DELETE" });
    } catch (error) {
      if ((await tokens(path)).res.status !== 404) throw error;
    }
  }
  await c.query("UPDATE managed_api_keys SET status='revoked',revoked_at=now() WHERE id=$1", [
    key.id,
  ]);
}

const ownedKey = async (c: PoolClient, owner: string, id: string) =>
  (await c.query<KeyRow>("SELECT * FROM managed_api_keys WHERE id=$1 AND owner_id=$2", [id, owner]))
    .rows[0];

export const revokeOwnedKey = (owner: string, id: string) =>
  withOwnerLock(owner, async (c) => {
    const key = await ownedKey(c, owner, id);
    if (!key) throw new Error("Key not found.");
    if (key.status !== "revoked") await revokeRow(c, key);
  });

export async function revokeKeysAndBlockSubject(subject: string) {
  const role = await db.query<{ admin: boolean }>("SELECT admin FROM app_access WHERE subject=$1", [
    subject,
  ]);
  if (role.rows[0]?.admin) return false;
  const users = await db.query<{ userId: string }>(
    'SELECT "userId" FROM account WHERE "providerId"=$1 AND "accountId"=$2',
    ["hackclub", subject],
  );
  const owner = users.rows[0]?.userId;
  const block = async (c: PoolClient) =>
    !!(
      await c.query(
        "INSERT INTO app_access(subject,allowed) VALUES($1,false) ON CONFLICT(subject) DO UPDATE SET allowed=false WHERE NOT app_access.admin RETURNING subject",
        [subject],
      )
    ).rowCount;
  if (!owner) {
    const c = await db.connect();
    try {
      return await block(c);
    } finally {
      c.release();
    }
  }
  return withOwnerLock(owner, async (c) => {
    const keys = await c.query<KeyRow>(
      "SELECT * FROM managed_api_keys WHERE owner_id=$1 AND status IN ('pending','active','revoke_pending') AND expires_at>now()",
      [owner],
    );
    for (const key of keys.rows) await revokeRow(c, key);
    return block(c);
  });
}

export const rollOwnedKey = (
  owner: string,
  subject: string,
  id: string,
): Promise<IssuedCredentials> =>
  withOwnerLock(owner, async (c) => {
    await requireKeyAccess(c, owner, subject);
    const key = await ownedKey(c, owner, id);
    if (
      !key ||
      key.status !== "active" ||
      !key.cloudflare_id ||
      key.expires_at.getTime() <= Date.now()
    )
      throw new Error("Only active, unexpired keys can be rolled.");
    const owned = await ownedKeyBuckets(owner, c);
    if (key.buckets.some((b) => !owned.includes(b)))
      throw new Error(
        "This key includes a bucket no longer assigned to you. Revoke it and create a new key.",
      );
    const expected = tokenPolicy(account!, key.buckets, key.permission);
    const matches = (t: Token) =>
      t.id === key.cloudflare_id &&
      samePolicy(t, expected) &&
      Date.parse(t.expires_on || "") === key.expires_at.getTime();
    const path = `/${encodeURIComponent(key.cloudflare_id)}`;
    if (!matches(await tokenRequest<Token>(path)))
      throw new Error(
        "Cloudflare's key permissions or expiry differ from this record. Revoke it and create a new key.",
      );
    let value: string;
    try {
      value = await tokenRequest<string>(`${path}/value`, { method: "PUT" });
      if (typeof value !== "string" || !value || !matches(await tokenRequest<Token>(path)))
        throw new Error("Unconfirmed roll");
    } catch {
      // A lost response may still have invalidated the previous secret. Never retry silently.
      throw new Error(
        "The roll could not be confirmed. Your old secret may already be invalid. Roll again to get a new secret, or revoke this key.",
      );
    }
    return credentials(key, key.cloudflare_id, value, key.expires_at);
  });

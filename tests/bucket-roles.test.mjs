// Cloudflare is mocked; PostgreSQL permission checks and advisory locks are real.
// Set BUCKET_TEST_DATABASE_URL to enable integration tests in an isolated schema.
import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
const enabled = !!process.env.BUCKET_TEST_DATABASE_URL;
const integration = enabled ? test : test.skip;
const schema = `roles_test_${crypto.randomUUID().replaceAll("-", "")}`;
const url = new URL(process.env.BUCKET_TEST_DATABASE_URL || "postgresql://localhost/postgres");
const setup = new Pool({ connectionString: url.toString() });
url.searchParams.set("options", `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
process.env.BETTER_AUTH_URL = "http://localhost:3000";
let access;
let failRevoke = false;
let gate;
let started;
let writes = [];
const remote = new Map();
mock.module("server-only", () => ({}));
mock.module("../lib/access", () => ({ getAccess: async () => access }));
mock.module("next/cache", () => ({ revalidatePath: () => {} }));
mock.module("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));
mock.module("../lib/s3", () => ({
  validObjectKey: (key) => typeof key === "string" && key.length > 0,
  objectUrl: async () => {
    writes.push("upload");
    return "https://example.invalid/upload";
  },
  removeObject: async () => {
    writes.push("delete");
  },
  putFolder: async () => {
    writes.push("folder");
  },
  hasMultipartUploads: async () => false,
}));
mock.module("../lib/cloudflare", () => ({
  account: "test",
  r2Endpoint: "https://example.invalid",
  cloudflareConfigured: () => true,
  cloudflareBuckets: async () => [{ name: "shared", creation_date: new Date().toISOString() }],
  r2: (name = "") => name,
  bucketSetting: async (_bucket, path, init) => {
    if (init) writes.push({ path, body: init.body && JSON.parse(init.body) });
    return path === "/domains/custom" ? { domains: [] } : { id: "job", status: "completed" };
  },
  cf: async (path, init) => {
    const id = path.split("/").at(-1);
    if (init?.method === "POST" && path.endsWith("/tokens")) {
      started?.();
      if (gate) await gate;
      const token = {
        ...JSON.parse(init.body),
        id: crypto.randomUUID(),
        value: "test-only-secret",
      };
      remote.set(token.id, token);
      return { ok: true, res: { status: 200 }, data: { result: token } };
    }
    if (init?.method === "DELETE" && path.includes("/tokens/")) {
      if (failRevoke) throw new Error("Simulated remote failure");
      remote.delete(id);
    }
    return { ok: true, res: { status: 200 }, data: { result: remote.get(id) } };
  },
}));
const { db } = await import("../lib/db");
const { bucketAccess, withBucket } = await import("../lib/objects");
const { issueKey, rollOwnedKey } = await import("../lib/api-keys");
const { assignBucket, changeBucketRole } = await import("../app/admin/actions");
const { saveSetting, addCustomDomain, changeCustomDomain } =
  await import("../app/settings-actions");
const { createUploadUrl, deleteObject, createFolder, emptyBucket, deleteBucket } =
  await import("../app/object-actions");
const asUser = (id = "alice", admin = false) => {
  access = { allowed: true, admin, subject: id, user: { id } };
};
const form = (values) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
const change = (role) => changeBucketRole(null, form({ bucket: "shared", user: "alice", role }));
const request = (permission = "read-write", buckets = ["shared"]) => ({
  id: crypto.randomUUID(),
  name: "test",
  permission,
  buckets,
  expiresAt: new Date(Date.now() + 86400000),
});

beforeAll(async () => {
  if (!enabled) return;
  await setup.query(`CREATE SCHEMA ${schema}`);
  await db.query(
    `CREATE TABLE "user" (id text PRIMARY KEY, email text, "emailVerified" boolean); CREATE TABLE account ("userId" text,"providerId" text,"accountId" text);`,
  );
  await db.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  await db.query(
    `INSERT INTO "user" VALUES ('alice','alice@hackclub.com',true),('bob','bob@hackclub.com',true),('admin','admin@hackclub.com',true); INSERT INTO account VALUES ('alice','hackclub','alice'),('bob','hackclub','bob');`,
  );
});
beforeEach(async () => {
  if (!enabled) return;
  await db.query(`TRUNCATE managed_api_keys,managed_buckets CASCADE;
    INSERT INTO managed_buckets(name,owner_id,status) VALUES ('shared','alice','active'),('other','alice','active');
    INSERT INTO bucket_members(bucket_name,user_id) VALUES ('shared','alice'),('other','alice'),('shared','bob');`);
  asUser();
  failRevoke = false;
  gate = undefined;
  started = undefined;
  writes = [];
  remote.clear();
});
afterAll(async () => {
  await db.end();
  if (enabled) await setup.query(`DROP SCHEMA ${schema} CASCADE`);
  await setup.end();
});
integration("migration preserves existing access and reruns preserve assigned roles", async () => {
  // Start with populated memberships from the previous schema, without a role column.
  await db.query("ALTER TABLE bucket_members DROP COLUMN role");
  await db.query(await readFile(new URL("../db/bucket-roles.sql", import.meta.url), "utf8"));
  expect((await db.query("SELECT DISTINCT role FROM bucket_members")).rows).toEqual([
    { role: "manager" },
  ]);
  await db.query("UPDATE bucket_members SET role='viewer' WHERE user_id='alice'");
  await db.query(await readFile(new URL("../db/bucket-roles.sql", import.meta.url), "utf8"));
  expect(
    (await db.query("SELECT DISTINCT role FROM bucket_members WHERE user_id='alice'")).rows,
  ).toEqual([{ role: "viewer" }]);
  await expect(db.query("UPDATE bucket_members SET role='owner'")).rejects.toThrow();
});
integration(
  "Viewer and Editor are denied every manager operation; Viewer cannot mutate objects",
  async () => {
    for (const role of ["viewer", "editor"]) {
      await db.query("UPDATE bucket_members SET role=$1 WHERE user_id='alice'", [role]);
      expect(await bucketAccess("shared")).toBeTruthy();
      expect(await bucketAccess("shared", "manager")).toBeNull();
      expect(await withBucket("shared", async () => "unexpected")).toBe("Bucket not found.");
      expect(
        await saveSetting(null, form({ bucket: "shared", setting: "cors", value: "[]" })),
      ).toBe("Bucket not found.");
      expect(await addCustomDomain(null, form({ bucket: "shared", subdomain: "test" }))).toBe(
        "Bucket not found.",
      );
      expect(await changeCustomDomain("shared", "test.hackclub-assets.com", "remove")).toBe(
        "Domain not found.",
      );
      expect(
        (await emptyBucket(null, form({ bucket: "shared", confirmation: "EMPTY shared" }))).state,
      ).toBe("error");
      expect(await deleteBucket(null, form({ bucket: "shared", confirmation: "shared" }))).toBe(
        "Bucket not found.",
      );
      expect(await change("manager")).toBe("Administrator access required.");
      if (role === "viewer") {
        expect((await createUploadUrl("shared", "file.txt", 10)).error).toBe("Bucket not found.");
        expect(await deleteObject("shared", "file.txt")).toBe("Object not found.");
        expect(await createFolder("shared", "", "folder")).toBe("Bucket not found.");
        expect(writes).toEqual([]);
      } else {
        expect((await createUploadUrl("shared", "file.txt", 10)).url).toBeTruthy();
        expect(await deleteObject("shared", "file.txt")).toBeNull();
        expect(await createFolder("shared", "", "folder")).toBeNull();
      }
    }
  },
);
integration(
  "role downgrade revokes scoped write keys, keeps read keys, and checks mixed bucket scope",
  async () => {
    const write = await issueKey("alice", "alice", request("read-write", ["shared", "other"]));
    const read = await issueKey("alice", "alice", request("read"));
    const unrelated = await issueKey("alice", "alice", request("read-write", ["other"]));
    asUser("admin", true);
    failRevoke = true;
    expect(await change("viewer")).toContain("Role was not changed");
    expect(
      (
        await db.query(
          "SELECT role FROM bucket_members WHERE bucket_name='shared' AND user_id='alice'",
        )
      ).rows[0].role,
    ).toBe("manager");
    failRevoke = false;
    expect(await change("viewer")).toBe("Role updated.");
    expect(remote.has(write.accessKeyId)).toBe(false);
    expect(remote.has(read.accessKeyId)).toBe(true);
    expect(remote.has(unrelated.accessKeyId)).toBe(true);
    asUser();
    await expect(issueKey("alice", "alice", request())).rejects.toThrow("role");
    await expect(
      issueKey("alice", "alice", request("read-write", ["other", "shared"])),
    ).rejects.toThrow("role");
    expect((await issueKey("alice", "alice", request("read"))).permission).toBe("read");
    const row = (
      await db.query("SELECT id FROM managed_api_keys WHERE cloudflare_id=$1", [write.accessKeyId])
    ).rows[0];
    await expect(rollOwnedKey("alice", "alice", row.id)).rejects.toThrow("Only active");
    asUser("bob");
    expect((await bucketAccess("shared")).role).toBe("manager");
  },
);
integration("issuance and downgrade serialize across the remote token request", async () => {
  let release;
  gate = new Promise((resolve) => {
    release = resolve;
  });
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const issuance = issueKey("alice", "alice", request());
  await ready;
  asUser("admin", true);
  expect(await change("viewer")).toContain("Another key operation");
  release();
  const key = await issuance;
  expect(await change("viewer")).toBe("Role updated.");
  expect(remote.has(key.accessKeyId)).toBe(false);
});
integration(
  "admin grants explicit roles and Manager saves validated rules with lifecycle confirmation",
  async () => {
    asUser("admin", true);
    expect(
      await assignBucket(null, form({ bucket: "shared", owner: "admin", role: "viewer" })),
    ).toBe("Access granted.");
    expect(
      await assignBucket(null, form({ bucket: "shared", owner: "bob", role: "owner" })),
    ).toContain("Choose Viewer");
    asUser();
    const lifecycle = JSON.stringify([
      {
        id: "expire",
        enabled: true,
        conditions: { prefix: "temp/" },
        deleteObjectsTransition: { condition: { type: "Age", maxAge: 86400 } },
      },
    ]);
    expect(
      await saveSetting(null, form({ bucket: "shared", setting: "lifecycle", value: lifecycle })),
    ).toContain("Confirm");
    expect(
      await saveSetting(
        null,
        form({ bucket: "shared", setting: "lifecycle", value: lifecycle, confirm: "yes" }),
      ),
    ).toBe("Saved.");
    expect(writes.at(-1)).toEqual({ path: "/lifecycle", body: { rules: JSON.parse(lifecycle) } });
    const count = writes.length;
    expect(
      await saveSetting(
        null,
        form({ bucket: "shared", setting: "cors", value: '[{"allowed":{"methods":["GET"]}}]' }),
      ),
    ).toContain("origin");
    expect(writes.length).toBe(count);
    expect(await saveSetting(null, form({ bucket: "shared", setting: "cors", value: "[]" }))).toBe(
      "Saved.",
    );
    expect(writes.at(-1)).toEqual({ path: "/cors", body: { rules: [] } });
  },
);

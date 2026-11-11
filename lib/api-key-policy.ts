import { bucketName, hasControl } from "./format";

const MAX_KEY_DAYS = 365;
export type KeyPermission = "read" | "read-write";
export type KeyRequest = {
  id: string;
  name: string;
  permission: KeyPermission;
  buckets: string[];
  expiresAt: Date;
};
export const isKeyId = (id: unknown): id is string =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function parseKeyRequest(form: FormData, now = new Date()): KeyRequest {
  const [id, name, permission, duration] = ["requestId", "name", "permission", "duration"].map(
    (k) => form.get(k),
  );
  const buckets = [...new Set(form.getAll("buckets"))];
  if (!isKeyId(id)) throw new Error("Reopen the create-key dialog and try again.");
  if (typeof name !== "string" || !name.trim() || name.trim().length > 60 || hasControl(name))
    throw new Error("Give your key a name of up to 60 characters.");
  if (permission !== "read" && permission !== "read-write")
    throw new Error("Choose read-only or read/write access.");
  if (!buckets.length || buckets.some((b) => typeof b !== "string" || !bucketName.test(b)))
    throw new Error("Select at least one of your buckets.");
  let expiresAt: Date;
  if (duration === "custom") {
    const value = form.get("expiresAt");
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value))
      throw new Error("Choose an expiry date and time.");
    expiresAt = new Date(value);
  } else {
    const days = Number(duration);
    if (!Number.isInteger(days) || days < 1 || days > MAX_KEY_DAYS)
      throw new Error(
        "Keys can last between one day and one year, or use a shorter custom expiry.",
      );
    expiresAt = new Date(now.getTime() + days * 86400000);
  }
  const ttl = expiresAt.getTime() - now.getTime();
  if (!Number.isFinite(ttl) || ttl < 60000 || ttl > MAX_KEY_DAYS * 86400000)
    throw new Error("Expiry must be at least one minute away and no more than 365 days from now.");
  return {
    id: id.toLowerCase(),
    name: name.trim(),
    permission,
    buckets: (buckets as string[]).sort(),
    expiresAt,
  };
}
export function tokenPolicy(account: string, buckets: string[], permission: KeyPermission) {
  return [
    {
      effect: "allow",
      resources: Object.fromEntries(
        buckets.map((b) => [`com.cloudflare.edge.r2.bucket.${account}_default_${b}`, "*"]),
      ),
      permission_groups: [
        {
          id:
            permission === "read"
              ? "6a018a9f2fc74eb6b293b0c548f38b39"
              : "2efd5506f9c8494dacb1fa10a3e7d5b6",
        },
      ],
    },
  ];
}

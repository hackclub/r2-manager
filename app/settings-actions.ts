"use server";
import { revalidatePath } from "next/cache";
import { bucketAccess, withBucket } from "@/lib/objects";
import { bucketSetting, cf } from "@/lib/cloudflare";
import { isUniqueViolation } from "@/lib/db";
import { parseRules } from "@/lib/rule-policy";
import { storageClasses } from "@/lib/format";

const put = (body: unknown) => ({ method: "PUT", body: JSON.stringify(body) });
const settings = (bucket: string) => revalidatePath(`/buckets/${bucket}/settings`);

export async function saveSetting(_: string | null, form: FormData): Promise<string | null> {
  const [bucket, setting, value] = ["bucket", "setting", "value"].map((k) => form.get(k));
  if (!(await bucketAccess(bucket, "manager"))) return "Bucket not found.";
  if (typeof setting !== "string" || typeof value !== "string" || value.length > 50000)
    return "Invalid setting.";
  const b = bucket as string,
    confirmed = form.get("confirm") === "yes";
  try {
    if (setting === "storage") {
      if (!Object.hasOwn(storageClasses, value)) return "Invalid storage class.";
      await bucketSetting(b, "", { method: "PATCH", headers: { "cf-r2-storage-class": value } });
    } else if (setting === "public") {
      if (value !== "true" && value !== "false") return "Invalid public access setting.";
      if (value === "true" && !confirmed)
        return "Confirm that you understand the bucket will be public.";
      await bucketSetting(b, "/domains/managed", put({ enabled: value === "true" }));
    } else if (["cors", "lifecycle", "lock"].includes(setting)) {
      if (setting !== "cors" && !confirmed)
        return "Confirm that you understand these rules can affect existing objects.";
      let rules: unknown;
      try {
        rules =
          setting === "cors" || setting === "lifecycle"
            ? parseRules(setting, value)
            : JSON.parse(value);
      } catch (e) {
        return e instanceof Error ? e.message : "Enter valid JSON.";
      }
      if (!Array.isArray(rules) || rules.length > 100)
        return "Rules must be a JSON array of at most 100 items.";
      await bucketSetting(b, `/${setting}`, put({ rules }));
    } else return "Invalid setting.";
    settings(b);
    return "Saved.";
  } catch (e) {
    return e instanceof Error ? `Could not save: ${e.message}` : "Could not save setting.";
  }
}

export async function addCustomDomain(_: string | null, form: FormData): Promise<string | null> {
  const [bucket, subdomain] = [form.get("bucket"), form.get("subdomain")];
  if (!(await bucketAccess(bucket, "manager"))) return "Bucket not found.";
  if (typeof subdomain !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain))
    return "Use a lowercase subdomain containing letters, numbers, and hyphens.";
  if (form.get("confirm") !== "yes") return "Confirm that the domain will make the bucket public.";
  const zoneId = process.env.R2_CUSTOM_DOMAIN_ZONE_ID;
  if (!zoneId || !/^[a-f0-9]{32}$/.test(zoneId))
    return "Custom domains are not configured. Contact the administrator.";
  const b = bucket as string,
    hostname = `${subdomain}.hackclub-assets.com`;
  return withBucket(b, async (c) => {
    const unreserve = () =>
      c.query(
        "DELETE FROM managed_domains WHERE hostname=$1 AND bucket_name=$2 AND status='pending'",
        [hostname, b],
      );
    try {
      await c.query(
        "INSERT INTO managed_domains(hostname,bucket_name,status) VALUES ($1,$2,'pending')",
        [hostname, b],
      );
    } catch (e) {
      if (isUniqueViolation(e)) return "That hostname is already reserved.";
      throw e;
    }
    try {
      const q = new URLSearchParams({ "name.exact": hostname, per_page: "1" });
      const { ok, data } = await cf(`zones/${zoneId}/dns_records?${q}`);
      if (!ok || !Array.isArray(data.result)) throw new Error("DNS verification failed");
      if (data.result.length) {
        await unreserve();
        return "That hostname already has a DNS record.";
      }
    } catch {
      await unreserve();
      return "Unable to check DNS. Contact the administrator.";
    }
    try {
      await bucketSetting(b, "/domains/custom", {
        method: "POST",
        body: JSON.stringify({ domain: hostname, zoneId, enabled: true }),
      });
      await c.query(
        "UPDATE managed_domains SET status='active' WHERE hostname=$1 AND bucket_name=$2",
        [hostname, b],
      );
      settings(b);
      return "Domain added.";
    } catch {
      return "The domain connection could not be confirmed. Contact the administrator before retrying.";
    }
  });
}

export async function changeCustomDomain(bucket: string, hostname: string, operation: string) {
  if (
    typeof hostname !== "string" ||
    !["enable", "disable", "remove"].includes(operation) ||
    !(await bucketAccess(bucket, "manager"))
  )
    return "Domain not found.";
  const remove = operation === "remove";
  return withBucket(
    bucket,
    async (c) => {
      try {
        const live = await bucketSetting<{ domains: { domain: string }[] }>(
          bucket,
          "/domains/custom",
        );
        if (!live.domains?.some((d) => d.domain === hostname))
          return "Domain not found on this bucket.";
        await bucketSetting(
          bucket,
          `/domains/custom/${encodeURIComponent(hostname)}`,
          remove ? { method: "DELETE" } : put({ enabled: operation === "enable" }),
        );
        if (remove)
          await c.query("DELETE FROM managed_domains WHERE hostname=$1 AND bucket_name=$2", [
            hostname,
            bucket,
          ]);
        settings(bucket);
        return null;
      } catch {
        return "The domain change could not be confirmed. Refresh before retrying.";
      }
    },
    true,
  );
}

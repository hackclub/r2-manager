import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { DomainTable, type CustomDomain } from "@/app/domain-table";
import { CopyValue } from "@/app/copy-value";
import { SettingsSkeleton } from "@/app/settings-skeleton";
import { EmptyBucketForm } from "@/app/empty-bucket-form";
import { DomainForm } from "@/app/domain-form";
import { SettingForm } from "@/app/setting-form";
import { DeleteBucketForm } from "@/app/delete-bucket-form";
import { db } from "@/lib/db";
import { bucketAccess } from "@/lib/objects";
import { locations } from "@/lib/format";
import { account, bucketSetting, r2Endpoint } from "@/lib/cloudflare";

const unavailable = <p className="mt-3 text-sm text-kumo-subtle">Unable to load this setting.</p>;

function Section({
  title,
  info,
  children,
}: {
  title: string;
  info: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-kumo-line py-7">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-kumo-subtle">{info}</p>
      {children}
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <dt className="text-kumo-subtle">{label}:</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

async function Settings({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const access = await bucketAccess(name);
  if (!access) notFound();
  if (access.role !== "manager")
    return (
      <main className="max-w-5xl px-6 py-8 lg:px-8">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-4 text-sm text-kumo-subtle">
          Manager access is required to change bucket settings. Your role is{" "}
          {access.role === "viewer" ? "Viewer" : "Editor"}.
        </p>
      </main>
    );
  const rules = (s: string) => bucketSetting<{ rules?: unknown[] }>(name, `/${s}`);
  const [bucket, managed, cors, lifecycle, lock, jobs, custom] = await Promise.allSettled([
    bucketSetting<{ storage_class?: string; creation_date?: string; location?: string }>(name, ""),
    bucketSetting<{ enabled: boolean; domain: string }>(name, "/domains/managed"),
    rules("cors"),
    rules("lifecycle"),
    rules("lock"),
    bucketSetting<{ jobs?: { id: string; jobType: string; status: string; startTime: string }[] }>(
      name,
      "/jobs?per_page=10",
    ),
    bucketSetting<{ domains: CustomDomain[] }>(name, "/domains/custom"),
  ]);
  const reserved = (
    await db.query<{ hostname: string; status: string }>(
      "SELECT hostname,status FROM managed_domains WHERE bucket_name=$1 ORDER BY hostname",
      [name],
    )
  ).rows.map((d) => ({ domain: d.hostname, reservation: d.status }));
  const details = bucket.status === "fulfilled" ? bucket.value : undefined;
  const loc = details?.location?.toLowerCase();
  const created = new Date(details?.creation_date ?? NaN);
  const ruleForm = (setting: "cors" | "lifecycle" | "lock", r: typeof cors) =>
    r.status === "fulfilled" ? (
      <SettingForm
        bucket={name}
        setting={setting}
        value={JSON.stringify(r.value.rules || [], null, 2)}
      />
    ) : (
      unavailable
    );
  return (
    <main className="max-w-5xl px-6 py-8 lg:px-8">
      <h1 className="text-xl font-semibold">Settings</h1>
      <section className="border-b border-kumo-line py-7">
        <h2 className="text-lg font-semibold">General</h2>
        <div className="mt-4 rounded-lg border border-kumo-line bg-kumo-base p-5">
          <dl className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-3">
            <Field label="Name" className="min-w-0">
              <CopyValue value={name} label="bucket name" />
            </Field>
            <Field label="Location">
              {loc
                ? `${locations[loc] || loc.toUpperCase()} (${loc.toUpperCase()})`
                : details
                  ? "Automatic"
                  : "Unavailable"}
            </Field>
            <Field label="Created">
              {Number.isNaN(created.getTime())
                ? "—"
                : created.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
            </Field>
            <Field label="S3 API" className="min-w-0 sm:col-span-3">
              {account ? (
                <CopyValue value={`${r2Endpoint}/${name}`} label="S3 API endpoint" alwaysVisible />
              ) : (
                "Unavailable"
              )}
            </Field>
          </dl>
        </div>
      </section>
      <Section
        title="Custom Domains"
        info="Connect a subdomain of hackclub-assets.com to publicly serve this bucket."
      >
        <DomainTable
          bucket={name}
          unavailable={custom.status === "rejected"}
          domains={
            custom.status === "fulfilled"
              ? [
                  ...custom.value.domains,
                  ...reserved.filter(
                    (d) => !custom.value.domains.some((l) => l.domain === d.domain),
                  ),
                ]
              : reserved
          }
        />
        <DomainForm bucket={name} />
      </Section>
      <Section
        title="Public Development URL"
        info="The r2.dev URL is intended for development and is rate limited. Enabling it makes objects publicly accessible."
      >
        {managed.status === "fulfilled" ? (
          <>
            <p className="mt-2 break-all text-sm">
              {managed.value.enabled ? `Enabled · https://${managed.value.domain}` : "Disabled"}
            </p>
            <SettingForm bucket={name} setting="public" value={String(managed.value.enabled)} />
          </>
        ) : (
          unavailable
        )}
      </Section>
      <Section
        title="CORS Policy"
        info="Specify which origins can make browser requests. Saving replaces the current rules."
      >
        {ruleForm("cors", cors)}
      </Section>
      <Section
        title="Object Lifecycle Rules"
        info="Rules can automatically delete or transition objects. Saving replaces all current rules."
      >
        {ruleForm("lifecycle", lifecycle)}
      </Section>
      <Section
        title="Bucket Lock Rules"
        info="Lock rules can prevent overwriting or deleting existing and new objects. Saving replaces all current rules."
      >
        {ruleForm("lock", lock)}
      </Section>
      <Section
        title="Default Storage Class"
        info="Applies to newly uploaded objects; existing objects retain their storage class."
      >
        {details ? (
          <SettingForm
            bucket={name}
            setting="storage"
            value={details.storage_class || "Standard"}
          />
        ) : (
          unavailable
        )}
      </Section>
      <section className="py-7">
        <h2 className="text-lg font-semibold">Danger Zone</h2>
        <h3 className="mt-5 font-semibold">Empty bucket</h3>
        <p className="mt-2 text-sm text-kumo-subtle">
          Permanently delete all objects. Stop uploads first; objects written after a job starts may
          remain. Bucket lock rules can prevent emptying.
        </p>
        <EmptyBucketForm
          name={name}
          jobs={jobs.status === "fulfilled" ? jobs.value.jobs || [] : []}
          historyUnavailable={jobs.status === "rejected"}
        />
        <h3 className="mt-8 font-semibold">Delete bucket</h3>
        <p className="mt-2 text-sm text-kumo-subtle">
          This permanently deletes an empty bucket with no pending uploads.
        </p>
        <DeleteBucketForm name={name} />
      </section>
    </main>
  );
}

export default function Page({ params }: { params: Promise<{ name: string }> }) {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <Settings params={params} />
    </Suspense>
  );
}

import { formatBytes, formatCount } from "@/lib/format";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ObjectBrowser } from "@/app/object-browser";
import { bucketAccess, listObjects } from "@/lib/objects";
import { bucketSetting } from "@/lib/cloudflare";
import { bucketOverview } from "@/lib/analytics";
import { InfoTip } from "@/app/info-tip";
import { GlobeIcon } from "@phosphor-icons/react/dist/ssr";

type Props = {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ prefix?: string; cursor?: string; folders?: string }>;
};
const learnMore = (
  <a
    href="https://developers.cloudflare.com/r2/pricing/#class-a-operations"
    target="_blank"
    rel="noreferrer"
    className="underline underline-offset-4"
  >
    Learn more ↗
  </a>
);

async function Contents({ params, searchParams }: Props) {
  const [{ name }, s] = await Promise.all([params, searchParams]);
  const access = await bucketAccess(name);
  if (!access) notFound();
  const prefix = typeof s.prefix === "string" ? s.prefix.slice(0, 1024) : "";
  const asFolders = s.folders !== "false";
  const [page, meta, pub, m, custom] = await Promise.all([
    listObjects(
      name,
      prefix,
      typeof s.cursor === "string" ? s.cursor.slice(0, 4096) : undefined,
      asFolders,
    ),
    bucketSetting<{ storage_class?: string }>(name, "").catch(() => null),
    bucketSetting<{ enabled: boolean }>(name, "/domains/managed").catch(() => null),
    bucketOverview(name),
    bucketSetting<{ domains: { enabled: boolean }[] }>(name, "/domains/custom").catch(() => null),
  ]);
  const stats: [string, string, React.ReactNode?][] = [
    [
      "Default Storage Class",
      meta?.storage_class ?? "—",
      "Indicates the storage class applied to new objects uploaded to this bucket.",
    ],
    [
      "Public Access",
      pub?.enabled || custom?.domains.some((d) => d.enabled)
        ? "Enabled"
        : pub && custom
          ? "Disabled"
          : "—",
      "Indicates if the bucket is accessible over the public internet. The bucket is publicly accessible if a custom domain or the public development URL is enabled.",
    ],
    ["Bucket Size", formatBytes(m.storage)],
    ...(["A", "B"] as const).map((k): [string, string, React.ReactNode] => [
      `Class ${k} Operations`,
      formatCount(m.operations?.[`class${k}`]),
      <span key={k}>
        {m.period}.{" "}
        {k === "A"
          ? "Operations that create, list, or copy objects, and manage buckets."
          : "Operations that read objects, their metadata, and bucket configuration."}{" "}
        {learnMore}
      </span>,
    ]),
  ];
  return (
    <main className="px-6 py-8 lg:px-8">
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-kumo-line text-sm sm:grid-cols-5">
        {stats.map(([label, value, tip]) => (
          <div
            key={label}
            className="border-r border-kumo-line bg-kumo-base px-4 py-4 last:border-r-0"
          >
            <div className="flex items-center gap-1.5 text-kumo-subtle">
              <span>{label}</span>
              {tip && <InfoTip label={label}>{tip}</InfoTip>}
            </div>
            <p className="mt-1 flex items-center gap-1.5">
              {label === "Public Access" && (
                <GlobeIcon size={16} className="text-kumo-subtle" aria-hidden="true" />
              )}
              {value}
            </p>
          </div>
        ))}
      </div>
      <ObjectBrowser
        bucket={name}
        prefix={prefix}
        folders={page.folders}
        objects={page.objects}
        cursor={page.cursor}
        asFolders={asFolders}
        canWrite={access.role !== "viewer"}
      />
    </main>
  );
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={null}>
      <Contents {...props} />
    </Suspense>
  );
}

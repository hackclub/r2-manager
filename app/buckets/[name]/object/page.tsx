import { PageSkeleton } from "@/app/page-skeleton";
/* oxlint-disable next/no-img-element, jsx-a11y/media-has-caption -- Private object previews use original media; caption tracks are not supplied. */
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { bucketAccess } from "@/lib/objects";
import { objectDetails, objectPreview, validObjectKey } from "@/lib/s3";
import { bucketSetting } from "@/lib/cloudflare";
import { formatBytes, bucketHref } from "@/lib/format";
import { CopyValue } from "@/app/copy-value";
import { DeleteObjectButton } from "@/app/delete-object-button";
import { LinkButton } from "@cloudflare/kumo/components/button";
import {
  KumoTable,
  KumoTableHeader,
  KumoTableBody,
  KumoTableRow,
  KumoTableHead,
  KumoTableCell,
} from "@/app/kumo-table";

type Props = { params: Promise<{ name: string }>; searchParams: Promise<{ key?: string }> };

async function Details({ params, searchParams }: Props) {
  const [{ name }, { key }] = await Promise.all([params, searchParams]);
  const access = await bucketAccess(name);
  if (typeof key !== "string" || !validObjectKey(key) || !access) notFound();
  const meta = await objectDetails(name, key).catch((e) => {
    if (e?.$metadata?.httpStatusCode === 404) notFound();
    throw e;
  });
  const [custom, managed, preview] = await Promise.all([
    bucketSetting<{ domains: { domain: string; enabled: boolean }[] }>(
      name,
      "/domains/custom",
    ).catch(() => null),
    bucketSetting<{ domain: string; enabled: boolean }>(name, "/domains/managed").catch(() => null),
    objectPreview(name, key, meta.contentType, meta.size || 0).catch(() => null),
  ]);
  const path = key.split("/").map(encodeURIComponent).join("/");
  const urls = [
    ...(custom?.domains || []).filter((d) => d.enabled).map((d) => ["Custom domain", d.domain]),
    ...(managed?.enabled ? [["Development URL", managed.domain]] : []),
  ].map(([type, domain]) => ({ type, url: `https://${domain}/${path}` }));
  const back = `${bucketHref(name)}?${new URLSearchParams({ prefix: key.slice(0, key.lastIndexOf("/") + 1) })}`;
  return (
    <main className="px-6 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Link className="text-sm text-kumo-link" href={back}>
            ← Back to objects
          </Link>
          <h1 className="mt-3 break-all text-xl font-semibold">{key}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton
            href={`/api/buckets/${encodeURIComponent(name)}/download?${new URLSearchParams({ key })}`}
          >
            Download
          </LinkButton>
          {access.role !== "viewer" && (
            <DeleteObjectButton bucket={name} objectKey={key} returnTo={back} />
          )}
        </div>
      </div>
      <section className="overflow-hidden rounded-lg border border-kumo-line">
        <h2 className="border-b border-kumo-line px-5 py-3 font-medium">Object Details</h2>
        <dl className="grid gap-5 bg-kumo-base p-5 text-sm sm:grid-cols-4">
          {[
            [
              "Last modified",
              meta.modified
                ? new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "long",
                    timeZone: "UTC",
                  }).format(meta.modified)
                : "—",
            ],
            ["Type", meta.contentType],
            [
              "Storage Class",
              (
                { STANDARD: "Standard", STANDARD_IA: "Infrequent Access" } as Record<string, string>
              )[meta.storageClass] ?? meta.storageClass,
            ],
            ["Size", formatBytes(meta.size)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-kumo-subtle">{label}</dt>
              <dd className="mt-2 break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="mt-6 overflow-hidden rounded-lg border border-kumo-line">
        <KumoTable className="w-full text-sm">
          <KumoTableHeader>
            <KumoTableRow>
              <KumoTableHead className="px-5 py-3">Type</KumoTableHead>
              <KumoTableHead className="px-5 py-3">URL</KumoTableHead>
            </KumoTableRow>
          </KumoTableHeader>
          <KumoTableBody>
            {urls.map(({ type, url }) => (
              <KumoTableRow key={url} className="border-t border-kumo-line">
                <KumoTableCell className="whitespace-nowrap px-5 py-3 text-kumo-subtle">
                  {type}
                </KumoTableCell>
                <KumoTableCell className="max-w-0 px-5 py-3">
                  <CopyValue value={url} label="object URL" />
                </KumoTableCell>
              </KumoTableRow>
            ))}
          </KumoTableBody>
        </KumoTable>
        {!urls.length && (
          <p className="p-5 text-sm text-kumo-subtle">
            This object has no enabled public URL. Use Download for authenticated access.
          </p>
        )}
      </section>
      <section className="mt-6 overflow-hidden rounded-lg border border-kumo-line">
        <h2 className="border-b border-kumo-line px-5 py-3 font-medium">Custom Metadata</h2>
        <dl className="space-y-3 p-5 text-sm">
          {Object.keys(meta.metadata).length ? (
            Object.entries(meta.metadata).map(([k, v]) => (
              <div key={k} className="grid gap-2 sm:grid-cols-2">
                <dt className="break-all text-kumo-subtle">{k}</dt>
                <dd className="break-all">{v}</dd>
              </div>
            ))
          ) : (
            <p className="text-kumo-subtle">No custom metadata set</p>
          )}
        </dl>
      </section>
      <section className="mt-6 overflow-hidden rounded-lg border border-kumo-line">
        <h2 className="border-b border-kumo-line px-5 py-3 font-medium">Object Preview</h2>
        <div className="p-5">
          {preview?.url ? (
            meta.contentType.startsWith("image/") ? (
              <img
                src={preview.url}
                alt={key}
                referrerPolicy="no-referrer"
                className="max-h-[32rem] max-w-full object-contain"
              />
            ) : meta.contentType.startsWith("video/") ? (
              <video
                src={preview.url}
                controls
                preload="metadata"
                className="max-h-[32rem] max-w-full"
              />
            ) : (
              <audio src={preview.url} controls preload="metadata" />
            )
          ) : preview?.text !== undefined ? (
            <>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words text-sm">
                {preview.text}
              </pre>
              {preview.truncated && (
                <p className="mt-3 text-xs text-kumo-subtle">
                  Showing the first 64 KB. Download to view the complete object.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-kumo-subtle">
              Preview is unavailable for this object. Download it to view its contents.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton page="object" />}>
      <Details {...props} />
    </Suspense>
  );
}

import { bucketHref } from "@/lib/format";
import Link from "next/link";
import { Suspense } from "react";
import { bucketChartMetrics } from "@/lib/metric-charts";
import { MetricsDashboard } from "./metrics-dashboard";

const ranges = [
  [24, "Last 24 hours"],
  [168, "Last 7 days"],
  [720, "Last 30 days"],
] as const;
export const metricHours = (v: unknown) => ranges.find(([n]) => String(n) === v)?.[0] ?? 24;

export function MetricsContent({
  buckets,
  hours,
  base,
}: {
  buckets: string[];
  hours: number;
  base: string;
}) {
  const named = base === "/analytics";
  return (
    <main className="px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Metrics</h1>
          <p className="mt-2 text-sm text-kumo-subtle">
            Monitor upload and download traffic, storage, and operations for your buckets.
          </p>
        </div>
        <div className="flex rounded-lg border border-kumo-line p-1 text-sm">
          {ranges.map(([n, label]) => (
            <Link
              key={n}
              href={`${base}?hours=${n}`}
              className={`rounded px-3 py-1.5 ${hours === n ? "bg-kumo-tint font-medium" : "text-kumo-subtle"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      {buckets.length ? (
        buckets.map((name) => (
          <Suspense key={name} fallback={<Skeleton name={name} named={named} />}>
            <Card name={name} hours={hours} named={named} />
          </Suspense>
        ))
      ) : (
        <p className="mt-8 rounded border border-kumo-line p-6 text-sm text-kumo-subtle">
          Create a bucket to view its metrics.
        </p>
      )}
    </main>
  );
}

const blocks = (n: number, h: string) =>
  Array.from({ length: n }, (_, i) => (
    <div key={i} className={`${h} animate-pulse rounded-lg border border-kumo-line bg-kumo-base`} />
  ));

function Skeleton({ name, named }: { name: string; named: boolean }) {
  return (
    <section className="mt-6" aria-label={`Loading metrics for ${name}`} aria-busy="true">
      {named && <h2 className="mb-4 text-sm font-medium">{name}</h2>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{blocks(5, "h-[108px]")}</div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">{blocks(6, "h-[382px]")}</div>
    </section>
  );
}

async function Card({ name, hours, named }: { name: string; hours: number; named: boolean }) {
  const data = await bucketChartMetrics(name, hours);
  return (
    <section className="mt-6">
      {named && (
        <h2 className="mb-4 text-sm font-medium">
          <Link className="text-kumo-link" href={bucketHref(name)}>
            {name}
          </Link>
        </h2>
      )}
      {data ? (
        <MetricsDashboard data={data} />
      ) : (
        <p className="rounded-lg border border-kumo-line p-6 text-sm text-kumo-subtle">
          Metrics are temporarily unavailable. Try again shortly.
        </p>
      )}
    </section>
  );
}

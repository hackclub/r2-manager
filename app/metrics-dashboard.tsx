"use client";
import dynamic from "next/dynamic";
import { Table } from "@cloudflare/kumo/components/table";
import { formatBytes, formatCount } from "@/lib/format";
import type { MetricChartData, ChartSeries } from "@/lib/metric-charts";
import { InfoTip } from "./info-tip";

const MetricsChart = dynamic(() => import("./metrics-chart"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[280px] animate-pulse rounded bg-kumo-base"
      aria-label="Loading chart"
      aria-busy="true"
    />
  ),
});

type Spec = {
  title: string;
  tip: string;
  field: keyof MetricChartData;
  bytes?: boolean;
  by: string;
};
const panels: Spec[] = [
  {
    title: "Average Storage",
    tip: "Mean of the reported storage samples for the selected time range, split by storage class.",
    field: "storage",
    bytes: true,
    by: "storage class",
  },
  {
    title: "Data Retrieved",
    tip: "Bytes retrieved from Infrequent Access objects. This is separate from download bandwidth.",
    field: "retrieval",
    bytes: true,
    by: "storage class",
  },
  {
    title: "Class A Operations",
    tip: "Operations that create, list, or copy objects, and manage buckets.",
    field: "a",
    by: "storage class",
  },
  {
    title: "Class B Operations",
    tip: "Operations that read objects, their metadata, and bucket configuration.",
    field: "b",
    by: "storage class",
  },
  {
    title: "Request Distribution",
    tip: "Requests grouped by operation type, including operations outside Class A and Class B.",
    field: "distribution",
    by: "operation type",
  },
  {
    title: "Bandwidth",
    tip: "Uploaded and downloaded bytes reported by Cloudflare. Transfers smaller than 100 KiB are excluded.",
    field: "bandwidth",
    bytes: true,
    by: "transfer direction",
  },
];

export function MetricsDashboard({ data }: { data: MetricChartData }) {
  const cards = [
    ["Average Storage", formatBytes(data.averageStorage)],
    ["Data Retrieved", formatBytes(data.retrieved)],
    ["Class A Operations", formatCount(data.classA)],
    ["Class B Operations", formatCount(data.classB)],
    ["Request Distribution", formatCount(data.requests)],
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <div
            key={label}
            className="min-h-[108px] rounded-lg border border-kumo-line bg-kumo-base p-4"
          >
            <p className="text-sm text-kumo-subtle">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {panels.map((p) => (
          <Panel key={p.field} {...p} series={data[p.field] as ChartSeries[]} />
        ))}
      </div>
      {data.limited && (
        <p className="mt-3 text-xs text-kumo-subtle">
          Cloudflare’s response limit was reached. Select a shorter time range for a complete
          breakdown.
        </p>
      )}
      <section className="mt-5 overflow-hidden rounded-lg border border-kumo-line">
        <h3 className="border-b border-kumo-line px-4 py-3 text-sm font-medium">
          Operations by type
        </h3>
        <Table className="w-full text-sm">
          <Table.Header>
            <Table.Row>
              <Table.Head className="px-4 py-2">Operation</Table.Head>
              <Table.Head className="px-4 py-2 text-right">Requests</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.operations.map((o) => (
              <Table.Row key={o.name} className="border-t border-kumo-line">
                <Table.Cell className="px-4 py-2">{o.name}</Table.Cell>
                <Table.Cell className="px-4 py-2 text-right tabular-nums">
                  {o.count.toLocaleString("en-US")}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        {!data.operations.length && (
          <p className="p-4 text-sm text-kumo-subtle">
            No operations reported for this time range.
          </p>
        )}
      </section>
    </>
  );
}

function Panel({ title, tip, field, bytes, by, series }: Spec & { series: ChartSeries[] }) {
  const shown = series.filter((s) => s.data.length);
  const sum = (s: ChartSeries) => s.data.reduce((n, p) => n + p[1], 0);
  // Storage is a level, so summarize it as a mean; the others are totals.
  const value = (s: ChartSeries) =>
    field === "storage" ? (s.data.length ? sum(s) / s.data.length : 0) : sum(s);
  const format = bytes ? formatBytes : formatCount;
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-kumo-line">
      <div className="flex items-center gap-2 border-b border-kumo-line px-4 py-3 text-sm text-kumo-subtle">
        <h3>{title}</h3>
        <InfoTip label={title}>{tip}</InfoTip>
      </div>
      <div className="bg-kumo-base p-4">
        <div className="mb-3 flex min-h-5 flex-wrap gap-x-4 gap-y-1 text-xs text-kumo-subtle">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              {s.name} <span className="tabular-nums text-kumo-default">{format(value(s))}</span>
            </span>
          ))}
        </div>
        {shown.length ? (
          <MetricsChart
            data={shown}
            bytes={bytes}
            label={`${title} by time and ${by}`}
            type={field === "distribution" ? "bar" : "line"}
          />
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-kumo-subtle">
            No data is available for this time range
          </div>
        )}
      </div>
    </section>
  );
}

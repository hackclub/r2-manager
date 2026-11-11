import "server-only";
import { operationClass } from "./analytics";
import { graphql } from "./cloudflare";

export type ChartSeries = { name: string; color: string; data: [number, number][] };
export type MetricChartData = {
  averageStorage: number | null;
  retrieved: number | null;
  classA: number | null;
  classB: number | null;
  requests: number | null;
  storage: ChartSeries[];
  retrieval: ChartSeries[];
  a: ChartSeries[];
  b: ChartSeries[];
  distribution: ChartSeries[];
  bandwidth: ChartSeries[];
  operations: { name: string; count: number }[];
  limited: boolean;
};
type Row = {
  dimensions: Record<string, string>;
  max: { payloadSize: number };
  sum: { requests: number; responseBytes: number; bytesUpload: number; bytesDownload: number };
};
type Value = (r: Row) => number;
const [blue, yellow, pink] = ["#3b82f6", "#eab308", "#ec4899"];
const palette = [blue, yellow, pink, "#22c55e", "#a78bfa", "#06b6d4", "#f97316", "#f43f5e"];
const ia = (r: Row) => r.dimensions.storageClass === "InfrequentAccess";
const requests: Value = (r) => r.sum.requests;
const total = (rows: Row[], v: Value) => rows.reduce((n, r) => n + v(r), 0);

function series(rows: Row[], grain: string, v: Value, keep: (r: Row) => boolean = () => true) {
  const points = new Map<number, number>();
  for (const r of rows) {
    const t = Date.parse(r.dimensions[grain]);
    if (keep(r) && Number.isFinite(t)) points.set(t, (points.get(t) || 0) + v(r));
  }
  return [...points].sort((a, b) => a[0] - b[0]);
}
const split = (rows: Row[], grain: string, v: Value): ChartSeries[] => [
  { name: "Standard", color: blue, data: series(rows, grain, v, (r) => !ia(r)) },
  { name: "Infrequent Access", color: yellow, data: series(rows, grain, v, ia) },
];

export async function bucketChartMetrics(
  bucket: string,
  hours: number,
): Promise<MetricChartData | null> {
  const grain = hours > 168 ? "date" : "datetimeHour";
  const end = new Date();
  const filter = "filter:{bucketName:$bucket,datetime_geq:$start,datetime_lt:$end}";
  const data = await graphql(
    `query Dashboard($account:string!,$bucket:string!,$start:Time!,$end:Time!){viewer{accounts(filter:{accountTag:$account}){
 operations:r2OperationsAdaptiveGroups(limit:10000,${filter},orderBy:[${grain}_ASC]){sum{requests responseBytes} dimensions{${grain} actionType storageClass}}
 storage:r2StorageAdaptiveGroups(limit:10000,${filter},orderBy:[${grain}_ASC]){max{payloadSize} dimensions{${grain} storageClass}}
 bandwidth:r2BandwidthUsageAdaptiveGroups(limit:1000,${filter},orderBy:[datetimeHour_ASC]){sum{bytesUpload bytesDownload} dimensions{datetimeHour}}
 }}}`,
    { bucket, start: new Date(+end - hours * 3600000).toISOString(), end: end.toISOString() },
  );
  if (!data?.operations || !data.storage || !data.bandwidth) return null;
  const { operations: ops, storage, bandwidth }: Record<string, Row[]> = data;
  const of = (c: string) => ops.filter((r) => operationClass(r.dimensions.actionType) === c);
  const [a, b] = [of("A"), of("B")];
  const retrieval = ops.filter((r) => ia(r) && r.dimensions.actionType === "GetObject");
  const counts = new Map<string, number>();
  for (const r of ops)
    counts.set(
      r.dimensions.actionType,
      (counts.get(r.dimensions.actionType) || 0) + r.sum.requests,
    );
  const size: Value = (r) => r.max.payloadSize;
  const sizes = series(storage, grain, size);
  const bytes: Value = (r) => r.sum.responseBytes;
  return {
    averageStorage: sizes.length ? sizes.reduce((n, p) => n + p[1], 0) / sizes.length : null,
    retrieved: total(retrieval, bytes),
    classA: total(a, requests),
    classB: total(b, requests),
    requests: total(ops, requests),
    storage: split(storage, grain, size),
    retrieval: [
      { name: "Infrequent Access", color: yellow, data: series(retrieval, grain, bytes) },
    ],
    a: split(a, grain, requests),
    b: split(b, grain, requests),
    distribution: [...counts.keys()].map((name, i) => ({
      name,
      color: palette[i % palette.length],
      data: series(ops, grain, requests, (r) => r.dimensions.actionType === name),
    })),
    bandwidth: [
      {
        name: "Download",
        color: blue,
        data: series(bandwidth, "datetimeHour", (r) => r.sum.bytesDownload),
      },
      {
        name: "Upload",
        color: pink,
        data: series(bandwidth, "datetimeHour", (r) => r.sum.bytesUpload),
      },
    ],
    operations: [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((x, y) => y.count - x.count),
    limited: ops.length === 10000 || storage.length === 10000 || bandwidth.length === 1000,
  };
}

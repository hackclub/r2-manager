import "server-only";
import { cache } from "react";
import { ownedKeyBuckets } from "./api-keys";
import { operationClass } from "./analytics";
import { rates, emptyUsage, usageCost, type StorageClass } from "./billing-cost";
import { cloudflareBuckets, graphql } from "./cloudflare";

type Storage = { dimensions: { date: string; storageClass: string }; max: { payloadSize: number } };
type Operation = {
  dimensions: { actionType: string; storageClass: string };
  sum: { requests: number; responseBytes: number };
};
export const billingPeriod = cache(() => {
  const end = new Date();
  return { start: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)), end };
});
const filter = "limit:1000,filter:{bucketName:$bucket,datetime_geq:$start,datetime_lt:$end}";

export async function bucketBill(name: string) {
  const { start, end } = billingPeriod();
  const data: { storage: Storage[]; operations: Operation[] } | null = await graphql(
    `query Billing($account:string!,$bucket:string!,$start:Time!,$end:Time!){viewer{accounts(filter:{accountTag:$account}){
      storage:r2StorageAdaptiveGroups(${filter}){max{payloadSize} dimensions{date storageClass}}
      operations:r2OperationsAdaptiveGroups(${filter}){sum{requests responseBytes} dimensions{actionType storageClass}}
    }}}`,
    { bucket: name, start: start.toISOString(), end: end.toISOString() },
  );
  return calculateBill(name, data, start, end);
}

function calculateBill(
  name: string,
  data: { storage: Storage[]; operations: Operation[] } | null,
  start: Date,
  end: Date,
) {
  if (
    !data?.storage ||
    !data.operations ||
    data.storage.length >= 1000 ||
    data.operations.length >= 1000
  )
    return null;
  const usage = { Standard: emptyUsage(), InfrequentAccess: emptyUsage() };
  for (const { dimensions: d, ...r } of [...data.storage, ...data.operations]) {
    if (!Object.hasOwn(rates, d.storageClass)) return null;
    const u = usage[d.storageClass as StorageClass];
    if ("max" in r) u.gbMonths += r.max.payloadSize / 1e9 / 30;
    else {
      const kind = operationClass((d as Operation["dimensions"]).actionType);
      if (kind) u[kind === "A" ? "a" : "b"] += r.sum.requests;
      if ((d as Operation["dimensions"]).actionType === "GetObject")
        u.retrieved += r.sum.responseBytes;
    }
  }
  const cost = { storage: 0, a: 0, b: 0, retrieval: 0 };
  for (const [s, u] of Object.entries(usage))
    for (const [k, v] of Object.entries(usageCost(u, s as StorageClass)))
      cost[k as keyof typeof cost] += v;
  return {
    name,
    usage,
    cost,
    total: Object.values(cost).reduce((n, c) => n + c, 0),
    storageAvailable: data.storage.length > 0,
    storageComplete:
      new Set(data.storage.map((r) => r.dimensions.date)).size >=
      Math.ceil((+end - +start) / 86400000),
  };
}

export async function ownedBills(owner: string) {
  return billsForBuckets(await ownedKeyBuckets(owner));
}

export async function accountBills() {
  const names = (await cloudflareBuckets()).map((b) => b.name).sort();
  if (!names.length) return [];
  const { start, end } = billingPeriod();
  // Group by bucket in one query instead of waiting for a request per bucket.
  // https://developers.cloudflare.com/r2/platform/metrics-analytics/
  const data: {
    storage: (Storage & { dimensions: Storage["dimensions"] & { bucketName: string } })[];
    operations: (Operation & { dimensions: Operation["dimensions"] & { bucketName: string } })[];
  } | null = await graphql(
    `
      query AccountBilling($account: string!, $start: Time!, $end: Time!) {
        viewer {
          accounts(filter: { accountTag: $account }) {
            storage: r2StorageAdaptiveGroups(
              limit: 10000
              filter: { datetime_geq: $start, datetime_lt: $end }
            ) {
              max {
                payloadSize
              }
              dimensions {
                bucketName
                date
                storageClass
              }
            }
            operations: r2OperationsAdaptiveGroups(
              limit: 10000
              filter: { datetime_geq: $start, datetime_lt: $end }
            ) {
              sum {
                requests
                responseBytes
              }
              dimensions {
                bucketName
                actionType
                storageClass
              }
            }
          }
        }
      }
    `,
    { start: start.toISOString(), end: end.toISOString() },
  );
  // A capped result could omit whole buckets. Fall back rather than show low totals.
  if (data && (data.storage?.length >= 10000 || data.operations?.length >= 10000))
    return billsForBuckets(names);
  return names.map((name) => ({
    name,
    bill: calculateBill(
      name,
      data?.storage && data.operations
        ? {
            storage: data.storage.filter((r) => r.dimensions.bucketName === name),
            operations: data.operations.filter((r) => r.dimensions.bucketName === name),
          }
        : null,
      start,
      end,
    ),
  }));
}

export async function billsForBuckets(names: string[]) {
  const rows: { name: string; bill: Awaited<ReturnType<typeof bucketBill>> }[] = [];
  // Bound concurrent Cloudflare requests for accounts with many buckets.
  for (let i = 0; i < names.length; i += 4)
    rows.push(
      ...(await Promise.all(
        names.slice(i, i + 4).map(async (name) => ({ name, bill: await bucketBill(name) })),
      )),
    );
  return rows;
}

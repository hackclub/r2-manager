import "server-only";
import { graphql } from "./cloudflare";

// Operation classes follow https://developers.cloudflare.com/r2/pricing/.
const classA = new Set(
  "ListBuckets PutBucket ListObjects ListObjectsV2 PutObject CopyObject CompleteMultipartUpload CreateMultipartUpload LifecycleStorageTierTransition ListMultipartUploads UploadPart UploadPartCopy ListParts PutBucketEncryption PutBucketCors PutBucketLifecycleConfiguration".split(
    " ",
  ),
);
const classB = new Set(
  "HeadBucket HeadObject GetObject UsageSummary GetBucketEncryption GetBucketLocation GetBucketCors GetBucketLifecycleConfiguration".split(
    " ",
  ),
);
export const operationClass = (action: string) =>
  classA.has(action) ? "A" : classB.has(action) ? "B" : null;

const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export async function bucketOverview(bucket: string) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const period = `${day.format(start)} – ${day.format(last)} (UTC, month to date)`;
  const data = await graphql(
    `
      query Overview(
        $account: string!
        $bucket: string!
        $start: Time!
        $storageStart: Time!
        $end: Time!
      ) {
        viewer {
          accounts(filter: { accountTag: $account }) {
            operations: r2OperationsAdaptiveGroups(
              limit: 1000
              filter: { bucketName: $bucket, datetime_geq: $start, datetime_lt: $end }
            ) {
              sum {
                requests
              }
              dimensions {
                actionType
              }
            }
            storage: r2StorageAdaptiveGroups(
              limit: 1
              filter: { bucketName: $bucket, datetime_geq: $storageStart, datetime_leq: $end }
              orderBy: [datetime_DESC]
            ) {
              max {
                payloadSize
              }
              dimensions {
                datetime
              }
            }
          }
        }
      }
    `,
    {
      bucket,
      start: start.toISOString(),
      storageStart: new Date(+now - 7 * 86400000).toISOString(),
      end: now.toISOString(),
    },
  );
  if (!data) return { period, storage: null, operations: null };
  const operations = { classA: 0, classB: 0 };
  for (const r of data.operations || []) {
    const c = operationClass(r.dimensions.actionType);
    if (c) operations[`class${c}`] += r.sum.requests;
  }
  return {
    period,
    storage: (data.storage?.[0]?.max.payloadSize ?? null) as number | null,
    operations,
  };
}

import { getAccess } from "@/lib/access";
import { listBuckets } from "@/lib/buckets";
import { graphql } from "@/lib/cloudflare";

export async function GET() {
  const a = await getAccess();
  if (!a?.allowed) return Response.json({}, { status: 403 });
  const buckets = await listBuckets(a.user.id);
  const sizes: Record<string, number | null> = Object.fromEntries(
    buckets.map((b) => [b.name, null]),
  );
  const end = new Date().toISOString(),
    start = new Date(Date.now() - 7 * 86400000).toISOString();
  // Batch storage-only queries rather than fetching full analytics for every row.
  // Unavailable measurements stay null, distinct from zero.
  for (let i = 0; i < buckets.length; i += 25) {
    const batch = buckets.slice(i, i + 25);
    const fields = batch.map(
      (b, j) =>
        `b${j}:r2StorageAdaptiveGroups(limit:1,filter:{bucketName:${JSON.stringify(b.name)},datetime_geq:$start,datetime_leq:$end},orderBy:[datetime_DESC]){max{payloadSize} dimensions{datetime}}`,
    );
    const data = await graphql(
      `query Sizes($account:string!,$start:Time!,$end:Time!){viewer{accounts(filter:{accountTag:$account}){${fields.join("\n")}}}}`,
      { start, end },
      15000,
    );
    batch.forEach((b, j) => {
      const size = data?.[`b${j}`]?.[0]?.max?.payloadSize;
      if (typeof size === "number") sizes[b.name] = size;
    });
  }
  return Response.json(sizes, { headers: { "Cache-Control": "private, no-store" } });
}

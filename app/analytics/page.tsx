import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { listBuckets } from "@/lib/buckets";
import { MetricsContent, metricHours } from "@/app/metrics-content";

type Props = { searchParams: Promise<{ hours?: string }> };
async function Analytics({ searchParams }: Props) {
  const [access, { hours }] = await Promise.all([getAccess(), searchParams]);
  if (!access?.allowed) redirect("/");
  const buckets = await listBuckets(access.user.id);
  return (
    <MetricsContent
      buckets={buckets.filter((b) => b.status === "active").map((b) => b.name)}
      hours={metricHours(hours)}
      base="/analytics"
    />
  );
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={null}>
      <Analytics {...props} />
    </Suspense>
  );
}

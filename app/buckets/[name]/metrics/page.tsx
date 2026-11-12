import { PageSkeleton } from "@/app/page-skeleton";
import { bucketHref } from "@/lib/format";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { bucketAccess } from "@/lib/objects";
import { MetricsContent, metricHours } from "@/app/metrics-content";

type Props = { params: Promise<{ name: string }>; searchParams: Promise<{ hours?: string }> };
async function Metrics({ params, searchParams }: Props) {
  const [{ name }, { hours }] = await Promise.all([params, searchParams]);
  if (!(await bucketAccess(name))) notFound();
  return (
    <MetricsContent
      buckets={[name]}
      hours={metricHours(hours)}
      base={`${bucketHref(name)}/metrics`}
    />
  );
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton page="metrics" />}>
      <Metrics {...props} />
    </Suspense>
  );
}

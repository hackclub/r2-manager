import { PageSkeleton } from "@/app/page-skeleton";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { bucketAccess } from "@/lib/objects";
import { BillingContent } from "@/app/billing/content";

type Props = { params: Promise<{ name: string }> };
async function Billing({ params }: Props) {
  const { name } = await params;
  const a = await bucketAccess(name);
  if (!a) notFound();
  return <BillingContent scope={{ bucket: name }} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton page="bucketBilling" />}>
      <Billing {...props} />
    </Suspense>
  );
}

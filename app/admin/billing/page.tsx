import { PageSkeleton } from "@/app/page-skeleton";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/access";
import { BillingContent } from "@/app/billing/content";

async function Billing() {
  const access = await getAccess();
  if (!access?.allowed || !access.admin) notFound();
  return <BillingContent scope={{ account: true }} />;
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton page="accountBilling" />}>
      <Billing />
    </Suspense>
  );
}

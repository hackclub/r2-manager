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
    <Suspense fallback={null}>
      <Billing />
    </Suspense>
  );
}

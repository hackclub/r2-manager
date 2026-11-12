import { PageSkeleton } from "@/app/page-skeleton";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { BillingContent } from "./content";

async function Billing() {
  const access = await getAccess();
  if (!access?.allowed) redirect("/");
  return <BillingContent scope={{ owner: access.user.id }} />;
}
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton page="billing" />}>
      <Billing />
    </Suspense>
  );
}

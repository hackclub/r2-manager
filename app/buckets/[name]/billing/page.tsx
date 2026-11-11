import { Suspense } from "react";
import { notFound } from "next/navigation";
import { bucketAccess } from "@/lib/objects";
import { BillingContent } from "@/app/billing/content";

type Props = { params: Promise<{ name: string }> };
async function Billing({ params }: Props) {
  const a = await bucketAccess((await params).name);
  if (!a) notFound();
  return <BillingContent owner={a.user.id} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={null}>
      <Billing {...props} />
    </Suspense>
  );
}

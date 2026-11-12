import { PageSkeleton } from "@/app/page-skeleton";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { KeyContent } from "./content";

async function Keys() {
  const access = await getAccess();
  if (!access?.allowed) redirect("/");
  return <KeyContent owner={access.user.id} />;
}
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton page="keys" />}>
      <Keys />
    </Suspense>
  );
}

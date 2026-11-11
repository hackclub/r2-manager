import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getAccess } from "@/lib/access";

async function CreatePage() {
  if (!(await getAccess())?.allowed) notFound();
  return redirect("/?create=1");
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CreatePage />
    </Suspense>
  );
}

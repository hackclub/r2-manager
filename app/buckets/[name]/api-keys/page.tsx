import { Suspense } from "react";
import { notFound } from "next/navigation";
import { bucketAccess } from "@/lib/objects";
import { KeyContent } from "@/app/api-keys/content";

type Props = { params: Promise<{ name: string }> };
async function Keys({ params }: Props) {
  const { name } = await params;
  const a = await bucketAccess(name);
  if (!a) notFound();
  return <KeyContent owner={a.user.id} bucket={name} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={null}>
      <Keys {...props} />
    </Suspense>
  );
}

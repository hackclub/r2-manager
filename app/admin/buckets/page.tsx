import { PageSkeleton } from "@/app/page-skeleton";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { cloudflareBuckets } from "@/lib/cloudflare";
import type { BucketRole } from "@/lib/bucket-policy";
import { Buckets } from "./buckets";

async function Content() {
  if (!(await getAccess())?.admin) notFound();
  const [users, managed, inventory, retired, members] = await Promise.all([
    db.query<{ id: string; name: string; email: string }>(
      'SELECT DISTINCT u.id,u.name,u.email FROM "user" u JOIN account a ON a."userId"=u.id AND a."providerId"=$1 ORDER BY u.name',
      ["hackclub"],
    ),
    db.query<{ name: string }>("SELECT name FROM managed_buckets ORDER BY name"),
    cloudflareBuckets(),
    db.query<{ name: string }>("SELECT name FROM retired_bucket_names"),
    db.query<{ bucket_name: string; id: string; name: string; email: string; role: BucketRole }>(
      'SELECT m.bucket_name,m.role,u.id,u.name,u.email FROM bucket_members m JOIN "user" u ON u.id=m.user_id ORDER BY u.name',
    ),
  ]);
  const known = new Set(managed.rows.map((b) => b.name));
  const retiredNames = new Set(retired.rows.map((b) => b.name));
  return (
    <Buckets
      users={users.rows}
      buckets={[
        ...inventory
          .filter((b) => !known.has(b.name))
          .map((b) => ({
            name: b.name,
            status: retiredNames.has(b.name) ? ("retired" as const) : ("unassigned" as const),
            members: [],
          })),
        ...managed.rows.map((b) => ({
          name: b.name,
          status: "assigned" as const,
          members: members.rows.filter((m) => m.bucket_name === b.name),
        })),
      ].sort(
        (a, b) =>
          Number(a.status === "assigned") - Number(b.status === "assigned") ||
          a.name.localeCompare(b.name),
      )}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton page="buckets" />}>
      <Content />
    </Suspense>
  );
}

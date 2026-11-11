import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { cloudflareBuckets } from "@/lib/cloudflare";
import { Buckets } from "./buckets";

async function Content() {
  if (!(await getAccess())?.admin) notFound();
  const [users, managed, inventory, retired] = await Promise.all([
    db.query<{ id: string; name: string; email: string }>(
      'SELECT DISTINCT u.id,u.name,u.email FROM "user" u JOIN account a ON a."userId"=u.id AND a."providerId"=$1 ORDER BY u.name',
      ["hackclub"],
    ),
    db.query<{ name: string; owner_id: string }>(
      "SELECT name,owner_id FROM managed_buckets ORDER BY name",
    ),
    cloudflareBuckets(),
    db.query<{ name: string }>("SELECT name FROM retired_bucket_names"),
  ]);
  const known = new Set(managed.rows.map((b) => b.name));
  const retiredNames = new Set(retired.rows.map((b) => b.name));
  const owners = new Map(users.rows.map((u) => [u.id, u]));
  return (
    <Buckets
      users={users.rows}
      buckets={[
        ...inventory
          .filter((b) => !known.has(b.name))
          .map((b) => ({
            name: b.name,
            status: retiredNames.has(b.name) ? ("retired" as const) : ("unassigned" as const),
            owner: null,
          })),
        ...managed.rows.map((b) => ({
          name: b.name,
          status: "assigned" as const,
          owner: {
            name: owners.get(b.owner_id)?.name || b.owner_id,
            email: owners.get(b.owner_id)?.email ?? null,
          },
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
    <Suspense
      fallback={<output className="block text-sm text-kumo-subtle">Loading buckets…</output>}
    >
      <Content />
    </Suspense>
  );
}

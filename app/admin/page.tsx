import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { cloudflareBuckets } from "@/lib/cloudflare";
import { AccessForm, AssignmentForm, PromoteButton } from "./forms";

async function Admin() {
  if (!(await getAccess())?.admin) notFound();
  const [users, entries, managed, inventory, retired] = await Promise.all([
    db.query<{ id: string; name: string; email: string; subject: string }>(
      'SELECT u.id,u.name,u.email,a."accountId" AS subject FROM "user" u JOIN account a ON a."userId"=u.id AND a."providerId"=$1 ORDER BY u.name',
      ["hackclub"],
    ),
    db.query<{ subject: string; allowed: boolean; admin: boolean }>(
      "SELECT * FROM app_access ORDER BY subject",
    ),
    db.query<{ name: string; owner_id: string }>("SELECT name,owner_id FROM managed_buckets"),
    cloudflareBuckets(),
    db.query<{ name: string }>("SELECT name FROM retired_bucket_names"),
  ]);
  const known = new Set(managed.rows.map((b) => b.name));
  const retiredNames = new Set(retired.rows.map((b) => b.name));
  const unassigned = inventory.filter((b) => !known.has(b.name));
  const subjects = new Set(
    [...users.rows.map((u) => u.subject), ...entries.rows.map((e) => e.subject)].filter(Boolean),
  );
  return (
    <main className="max-w-6xl px-6 py-8 lg:px-8">
      <h1 className="text-xl font-semibold">Administration</h1>
      <section className="mt-7 space-y-4">
        <h2 className="text-lg font-semibold">Access list</h2>
        <p className="text-sm text-kumo-subtle">
          Allow someone by their Hack Club Auth ID. They must sign in once before a bucket can be
          assigned to them.
        </p>
        <AccessForm />
        {Array.from(subjects).map((subject) => {
          const entry = entries.rows.find((e) => e.subject === subject);
          const allowed = Boolean(entry?.allowed || entry?.admin);
          const name = users.rows.find((u) => u.subject === subject)?.name;
          return (
            <div
              key={subject}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-kumo-line p-4"
            >
              <div>
                <p>
                  {name || "Not signed in yet"} {entry?.admin && "· Administrator"}
                </p>
                <p className="text-sm text-kumo-subtle">
                  {subject} · {allowed ? "Allowed" : "Blocked"}
                </p>
              </div>
              {!entry?.admin && (
                <div className="flex flex-wrap items-center gap-3">
                  <PromoteButton subject={subject} name={name || subject} />
                  <AccessForm subject={subject} allowed={allowed} />
                </div>
              )}
            </div>
          );
        })}
      </section>
      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">
          Unassigned Cloudflare buckets ({unassigned.length})
        </h2>
        <p className="text-sm text-kumo-subtle">
          Assign an existing bucket to a registered user. This grants that user control of its
          objects and settings.
        </p>
        {unassigned.map((bucket) => (
          <div key={bucket.name} className="space-y-3 rounded-lg border border-kumo-line p-4">
            <p className="font-medium">{bucket.name}</p>
            {retiredNames.has(bucket.name) ? (
              <p className="text-sm text-kumo-subtle">
                Retired name · requires manual reconciliation
              </p>
            ) : (
              <AssignmentForm bucket={bucket.name} users={users.rows} />
            )}
          </div>
        ))}
        {!unassigned.length && (
          <p className="text-sm text-kumo-subtle">All Cloudflare buckets have an owner.</p>
        )}
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Assigned buckets</h2>
        {managed.rows.map((bucket) => (
          <p key={bucket.name} className="text-sm">
            {bucket.name} ·{" "}
            {users.rows.find((u) => u.id === bucket.owner_id)?.name || bucket.owner_id}
          </p>
        ))}
      </section>
    </main>
  );
}
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Admin />
    </Suspense>
  );
}

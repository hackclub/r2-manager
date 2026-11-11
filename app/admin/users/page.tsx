import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/access";
import { accessAllowed } from "@/lib/access-policy";
import { db } from "@/lib/db";
import { Users } from "./users";

async function Content() {
  if (!(await getAccess())?.admin) notFound();
  const [users, entries] = await Promise.all([
    db.query<{ id: string; name: string; email: string; emailVerified: boolean; subject: string }>(
      'SELECT u.id,u.name,u.email,u."emailVerified",a."accountId" AS subject FROM "user" u JOIN account a ON a."userId"=u.id AND a."providerId"=$1 ORDER BY u.name',
      ["hackclub"],
    ),
    db.query<{ subject: string; allowed: boolean; admin: boolean }>(
      "SELECT * FROM app_access ORDER BY subject",
    ),
  ]);
  const identities = new Map(users.rows.map((u) => [u.subject, u]));
  const permissions = new Map(entries.rows.map((e) => [e.subject, e]));
  const subjects = new Set([...identities.keys(), ...permissions.keys()].filter(Boolean));
  return (
    <Users
      users={Array.from(subjects, (subject) => {
        const user = identities.get(subject);
        const entry = permissions.get(subject);
        return {
          subject,
          name: user?.name ?? "Not signed in yet",
          email: user?.email ?? null,
          admin: Boolean(entry?.admin),
          allowed: user
            ? accessAllowed(subject, user, entry)
            : Boolean(entry?.allowed || entry?.admin),
        };
      }).sort((a, b) => a.name.localeCompare(b.name) || a.subject.localeCompare(b.subject))}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<output className="block text-sm text-kumo-subtle">Loading users…</output>}>
      <Content />
    </Suspense>
  );
}

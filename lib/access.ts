import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { accessAllowed } from "./access-policy";

export const getAccess = cache(async function getAccess() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const result = await db.query<{ accountId: string }>(
    'SELECT "accountId" FROM "account" WHERE "userId" = $1 AND "providerId" = $2',
    [session.user.id, "hackclub"],
  );
  const subject = result.rows[0]?.accountId;
  const permission = subject
    ? await db.query<{ allowed: boolean; admin: boolean }>(
        "SELECT allowed,admin FROM app_access WHERE subject=$1",
        [subject],
      )
    : null;
  const entry = permission?.rows[0];
  const admin = entry?.admin === true;
  return {
    user: session.user,
    subject,
    admin,
    allowed: accessAllowed(subject, session.user, entry),
  };
});

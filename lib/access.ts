import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { accessAllowed } from "./access-policy";

type Identity = { id: string; email: string; emailVerified: boolean };
export type Access<U extends Identity = Identity> = {
  user: U;
  subject: string | undefined;
  admin: boolean;
  allowed: boolean;
};

export async function resolveAccess<U extends Identity>(user: U): Promise<Access<U>> {
  const {
    rows: [row],
  } = await db.query<{ subject: string; allowed: boolean | null; admin: boolean | null }>(
    `SELECT a."accountId" AS subject,p.allowed,p.admin FROM account a
       LEFT JOIN app_access p ON p.subject=a."accountId"
       WHERE a."userId"=$1 AND a."providerId"='hackclub'`,
    [user.id],
  );
  const entry =
    row?.allowed == null ? undefined : { allowed: row.allowed, admin: row.admin === true };
  return {
    user,
    subject: row?.subject,
    admin: entry?.admin === true,
    allowed: accessAllowed(row?.subject, user, entry),
  };
}

export async function accessForUser(id: string) {
  const {
    rows: [user],
  } = await db.query<Identity & { name: string }>(
    'SELECT id,name,email,"emailVerified" FROM "user" WHERE id=$1',
    [id],
  );
  return user ? resolveAccess(user) : null;
}

export const getAccess = cache(async function getAccess() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? resolveAccess(session.user) : null;
});

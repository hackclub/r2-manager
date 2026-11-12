import "server-only";
import { accessForUser } from "../access";
import { db, tx } from "../db";
import { isScope, type Scope } from "./scopes";

export async function authorizeGrant({ sub, azp }: { sub?: unknown; azp?: unknown }) {
  if (typeof sub !== "string" || typeof azp !== "string") return null;
  const [access, consent] = await Promise.all([
    accessForUser(sub),
    db.query('SELECT 1 FROM "oauthConsent" WHERE "userId"=$1 AND "clientId"=$2', [sub, azp]),
  ]);
  return access?.allowed && consent.rowCount ? access : null;
}

export type Connection = {
  clientId: string;
  name: string;
  uri: string | null;
  redirectHosts: string[];
  scopes: Scope[];
  connectedAt: string;
};

const hosts = (uris: unknown) =>
  [
    ...new Set(
      (Array.isArray(uris) ? uris : []).flatMap((u) => {
        try {
          return [new URL(u).host || u];
        } catch {
          return [];
        }
      }),
    ),
  ].sort();

export async function listConnections(userId: string): Promise<Connection[]> {
  const { rows } = await db.query<{
    clientId: string;
    name: string | null;
    uri: string | null;
    redirectUris: unknown;
    scopes: string[];
    createdAt: Date;
  }>(
    `SELECT c."clientId",o.name,o.uri,o."redirectUris",c.scopes,c."createdAt"
       FROM "oauthConsent" c JOIN "oauthClient" o ON o."clientId"=c."clientId"
       WHERE c."userId"=$1 ORDER BY c."createdAt" DESC`,
    [userId],
  );
  return rows.map((r) => ({
    clientId: r.clientId,
    name: r.name || "Unnamed app",
    uri: r.uri,
    redirectHosts: hosts(r.redirectUris),
    scopes: r.scopes.filter(isScope),
    connectedAt: r.createdAt.toISOString(),
  }));
}

export const disconnect = (userId: string, clientId: string) =>
  tx(async (c) => {
    await c.query('DELETE FROM "oauthConsent" WHERE "userId"=$1 AND "clientId"=$2', [
      userId,
      clientId,
    ]);
    await c.query(
      'UPDATE "oauthRefreshToken" SET revoked=now() WHERE "userId"=$1 AND "clientId"=$2 AND revoked IS NULL',
      [userId, clientId],
    );
    await c.query('DELETE FROM "oauthAccessToken" WHERE "userId"=$1 AND "clientId"=$2', [
      userId,
      clientId,
    ]);
  });

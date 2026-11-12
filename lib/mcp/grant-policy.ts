import type { OAuthProviderExtension } from "@better-auth/oauth-provider";
import { db } from "../db";

type Consent = { id: string; scopes: string[] };

export async function currentConsent(userId: string, clientId: string) {
  const { rows } = await db.query<Consent>(
    'SELECT id,scopes FROM "oauthConsent" WHERE "userId"=$1 AND "clientId"=$2 AND "referenceId" IS NULL',
    [userId, clientId],
  );
  return rows[0];
}

export function grantMatches(consent: Consent | undefined, grant: unknown, scope: unknown) {
  return (
    !!consent &&
    typeof grant === "string" &&
    consent.id === grant &&
    typeof scope === "string" &&
    scope
      .split(" ")
      .filter(Boolean)
      .every((s) => consent.scopes.includes(s))
  );
}

// A deleted consent ID is never reused, including when an app reconnects immediately.
export const grantBinding: OAuthProviderExtension = {
  claims: {
    accessToken: async ({ user, client, scopes }) => {
      const consent = user && (await currentConsent(user.id, client.clientId));
      if (!consent || !scopes.every((s) => consent.scopes.includes(s)))
        throw new Error("The app must be approved again before issuing tokens.");
      return { r2_grant: consent.id };
    },
  },
};

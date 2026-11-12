import { betterAuth } from "better-auth";
import { genericOAuth, jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { db } from "./db";
import { mcpResource } from "./mcp/resource";
import { grantBinding } from "./mcp/grant-policy";
import { mcpScopes } from "./mcp/scopes";

export const auth = betterAuth({
  database: db,
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  account: { accountLinking: { enabled: false } },
  disabledPaths: ["/token"],
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "hackclub",
          discoveryUrl: "https://auth.hackclub.com/.well-known/openid-configuration",
          clientId: process.env.HACKCLUB_CLIENT_ID || "",
          clientSecret: process.env.HACKCLUB_CLIENT_SECRET || "",
          scopes: ["openid", "profile", "email"],
          pkce: true,
          requireIdTokenVerification: true,
        },
      ],
    }),
    jwt({ disableSettingJwtHeader: true }),
    mcp({
      resource: mcpResource,
      extensions: [grantBinding],
      loginPage: "/oauth/sign-in",
      consentPage: "/oauth/consent",
      scopes: ["openid", "offline_access", ...mcpScopes],
      grantTypes: ["authorization_code", "refresh_token"],
      clientRegistrationDefaultScopes: ["openid", "offline_access", ...mcpScopes],
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: "infer",
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 30 * 86400,
      refreshTokenReuseInterval: 0,
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
  ],
});

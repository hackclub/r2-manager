import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { db } from "./db";

export const auth = betterAuth({
  database: db,
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  account: { accountLinking: { enabled: false } },
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
  ],
});

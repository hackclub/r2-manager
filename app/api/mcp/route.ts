import { requireMcpAuth } from "@better-auth/mcp";
import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  type AuthInfo,
} from "@modelcontextprotocol/server";
import { auth } from "@/lib/auth";
import type { Access } from "@/lib/access";
import { authorizeGrant } from "@/lib/mcp/grants";
import { mcpResource } from "@/lib/mcp/resource";
import { mcpServer } from "@/lib/mcp/server";

const principals = new WeakMap<AuthInfo, Access>();
const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(new URL(mcpResource));

const mcp = createMcpHandler(({ authInfo }) => {
  const access = authInfo && principals.get(authInfo);
  if (!access) throw new Error("Unauthenticated MCP request");
  return mcpServer(access);
});

const revoked = () =>
  Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message: "This connection was revoked." }, id: null },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer error="invalid_token", error_description="The grant was revoked or the account lost access", resource_metadata="${resourceMetadataUrl}"`,
      },
    },
  );

export const POST = requireMcpAuth(
  auth,
  async (request, claims) => {
    const access = await authorizeGrant(claims);
    if (!access) return revoked();
    const authInfo: AuthInfo = {
      token: "",
      clientId: String(claims.azp),
      scopes: typeof claims.scope === "string" ? claims.scope.split(" ") : [],
      expiresAt: claims.exp,
      resource: new URL(mcpResource),
      resourceMetadataUrl,
    };
    principals.set(authInfo, access);
    return mcp.fetch(request, { authInfo });
  },
  { resource: mcpResource, requiredScopes: ["r2:read"] },
);

export const mcpResource = new URL(
  "/api/mcp",
  process.env.BETTER_AUTH_URL || "http://localhost:3000",
).href;

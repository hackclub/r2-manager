export const scopes = {
  "r2:read": {
    title: "Read your buckets",
    detail:
      "List buckets and objects, read object details and text, and create short-lived download links.",
  },
  "r2:write": {
    title: "Change bucket contents",
    detail:
      "Upload, overwrite, and delete objects and create folders in buckets where you are an Editor or Manager.",
  },
  openid: { title: "Know who you are", detail: "See your account ID." },
  offline_access: {
    title: "Stay connected",
    detail: "Keep access for up to 30 days without asking again, until you disconnect it.",
  },
} as const;
export type Scope = keyof typeof scopes;
export const mcpScopes = ["r2:read", "r2:write"] satisfies Scope[];
export const isScope = (s: string): s is Scope => Object.hasOwn(scopes, s);

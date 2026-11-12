export const corsMethods = ["GET", "HEAD", "PUT", "POST", "DELETE"] as const;
export type CorsRule = {
  id?: string;
  allowed: { origins: string[]; methods: string[]; headers?: string[]; [key: string]: unknown };
  exposeHeaders?: string[];
  maxAgeSeconds?: number;
  [key: string]: unknown;
};
export type LifecycleCondition =
  | { type: "Age"; maxAge: number; [key: string]: unknown }
  | { type: "Date"; date: string; [key: string]: unknown };
export type LifecycleRule = {
  id: string;
  enabled: boolean;
  conditions: { prefix: string; [key: string]: unknown };
  deleteObjectsTransition?: { condition: LifecycleCondition; [key: string]: unknown };
  abortMultipartUploadsTransition?: {
    condition: Extract<LifecycleCondition, { type: "Age" }>;
    [key: string]: unknown;
  };
  storageClassTransitions?: {
    condition: LifecycleCondition;
    storageClass: "InfrequentAccess";
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
};
export type RuleKind = "cors" | "lifecycle";
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: unknown, required = false): v is string[] =>
  Array.isArray(v) &&
  (!required || v.length > 0) &&
  v.every((s) => typeof s === "string" && !!s.trim());
function condition(v: unknown, ageOnly = false) {
  if (!record(v)) return false;
  return v.type === "Age"
    ? typeof v.maxAge === "number" && Number.isFinite(v.maxAge) && v.maxAge >= 0
    : !ageOnly &&
        v.type === "Date" &&
        typeof v.date === "string" &&
        /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v.date) &&
        Number.isFinite(Date.parse(v.date));
}
/** Validate both visual and advanced submissions on the server. Unknown fields are preserved. */
export function ruleError(kind: RuleKind, rules: unknown): string | null {
  if (!Array.isArray(rules) || rules.length > 100) return "Use an array of at most 100 rules.";
  const ids = new Set<string>();
  for (const [i, r] of rules.entries()) {
    const fail = (message: string) => `Rule ${i + 1}: ${message}`;
    if (!record(r)) return fail("must be an object.");
    if (r.id !== undefined && (typeof r.id !== "string" || !r.id.trim()))
      return fail("enter a nonempty rule name.");
    if (typeof r.id === "string") {
      if (ids.has(r.id)) return fail("rule names must be unique.");
      ids.add(r.id);
    }
    if (kind === "cors") {
      if (!record(r.allowed) || !strings(r.allowed.origins, true))
        return fail("enter at least one allowed origin.");
      if (
        !strings(r.allowed.methods, true) ||
        r.allowed.methods.some((m) => !corsMethods.includes(m as (typeof corsMethods)[number]))
      )
        return fail("select at least one supported HTTP method.");
      if (r.allowed.headers !== undefined && !strings(r.allowed.headers))
        return fail("request headers must be a list of nonempty strings.");
      if (r.exposeHeaders !== undefined && !strings(r.exposeHeaders))
        return fail("exposed headers must be a list of nonempty strings.");
      if (
        r.maxAgeSeconds !== undefined &&
        (typeof r.maxAgeSeconds !== "number" ||
          !Number.isInteger(r.maxAgeSeconds) ||
          r.maxAgeSeconds < 0 ||
          r.maxAgeSeconds > 86400)
      )
        return fail("preflight cache duration must be an integer from 0 to 86400 seconds.");
    } else {
      if (typeof r.id !== "string" || !r.id.trim()) return fail("enter a rule name.");
      if (typeof r.enabled !== "boolean") return fail("enabled must be true or false.");
      if (!record(r.conditions) || typeof r.conditions.prefix !== "string")
        return fail("enter an object prefix, or an empty prefix for the entire bucket.");
      if (
        r.deleteObjectsTransition !== undefined &&
        (!record(r.deleteObjectsTransition) || !condition(r.deleteObjectsTransition.condition))
      )
        return fail("choose a valid object deletion age or date.");
      if (
        r.abortMultipartUploadsTransition !== undefined &&
        (!record(r.abortMultipartUploadsTransition) ||
          !condition(r.abortMultipartUploadsTransition.condition, true))
      )
        return fail("choose a nonnegative multipart upload age.");
      if (
        r.storageClassTransitions !== undefined &&
        (!Array.isArray(r.storageClassTransitions) ||
          r.storageClassTransitions.some(
            (t) => !record(t) || t.storageClass !== "InfrequentAccess" || !condition(t.condition),
          ))
      )
        return fail("choose a valid Infrequent Access transition age or date.");
      if (
        !r.deleteObjectsTransition &&
        !r.abortMultipartUploadsTransition &&
        !(Array.isArray(r.storageClassTransitions) && r.storageClassTransitions.length)
      )
        return fail("add at least one lifecycle action.");
    }
  }
  return null;
}
export function parseRules(kind: RuleKind, value: string): unknown[] {
  let rules: unknown;
  try {
    rules = JSON.parse(value);
  } catch {
    throw new Error("Enter valid JSON.");
  }
  const error = ruleError(kind, rules);
  if (error) throw new Error(error);
  return rules as unknown[];
}

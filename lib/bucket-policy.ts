export const bucketRoles = { viewer: "Viewer", editor: "Editor", manager: "Manager" } as const;
export type BucketRole = keyof typeof bucketRoles;
export const isBucketRole = (value: unknown): value is BucketRole =>
  typeof value === "string" && Object.hasOwn(bucketRoles, value);
const rank: Record<BucketRole, number> = { viewer: 0, editor: 1, manager: 2 };
export function hasBucketRole(role: unknown, required: BucketRole = "viewer"): role is BucketRole {
  return isBucketRole(role) && rank[role] >= rank[required];
}

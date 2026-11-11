type Identity = { email: string; emailVerified: boolean };
type Permission = { allowed: boolean; admin: boolean };
export function accessAllowed(
  subject: string | undefined,
  user: Identity,
  entry: Permission | undefined,
) {
  if (!subject) return false;
  if (entry) return entry.admin || entry.allowed;
  return user.emailVerified === true && /^[^@\s]+@hackclub\.com$/i.test(user.email);
}

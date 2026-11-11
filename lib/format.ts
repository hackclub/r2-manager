const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.min(
    Math.max(0, Math.floor(Math.log(bytes) / Math.log(1000))),
    units.length - 1,
  );
  return `${number.format(bytes / 1000 ** index)} ${units[index]}`;
}

export const formatCount = (n: number | null | undefined) => (n == null ? "—" : compact.format(n));

export const hasControl = (s: string) => [...s].some((c) => c < " " || c === "\x7f");
export const bucketName = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export const locations: Record<string, string> = {
  wnam: "Western North America",
  enam: "Eastern North America",
  weur: "Western Europe",
  eeur: "Eastern Europe",
  apac: "Asia-Pacific",
  oc: "Oceania",
};
export const storageClasses = { Standard: "Standard", InfrequentAccess: "Infrequent Access" };
export const jobState = (status: string) => {
  const s = status.toUpperCase();
  return s === "COMPLETED"
    ? "completed"
    : ["FAILED", "ERROR", "CANCELLED", "CANCELED"].includes(s)
      ? "failed"
      : "running";
};
export const bucketHref = (name: string) => `/buckets/${encodeURIComponent(name)}`;

import { BillingSkeleton } from "./billing/skeleton";

const descriptions = {
  overview: [
    "R2 Object Storage",
    "High-performance storage for files and objects with zero egress charges.",
  ],
  metrics: [
    "Metrics",
    "Monitor upload and download traffic, storage, and operations for your buckets.",
  ],
  keys: ["API Keys", "Key me up! These keys give your apps access to your Cloudflare R2 buckets."],
  mcp: [
    "MCP",
    "Let AI assistants browse and manage your buckets. Connected apps sign in as you, ask for your approval, and can never do more than your bucket roles allow.",
  ],
  billing: [
    "Billing",
    "Usage and estimated cost for buckets currently assigned to you. This is not a bill or invoice, R2 is free for your work :)",
  ],
  bucketBilling: [
    "Billing",
    "Usage and estimated cost for this bucket. This is not a bill or invoice, R2 is free for your work :)",
  ],
  accountBilling: [
    "Billing",
    "Usage and estimated cost for all buckets in the Cloudflare account, including unassigned buckets. Estimates are before shared allowances and rounding; this is not a Cloudflare invoice.",
  ],
  objects: ["Objects", ""],
  object: ["Object Details", ""],
  users: ["Users", "Control who can use R2 Manager and manage the workspace."],
  buckets: ["Buckets", "Manage the people who can access each bucket."],
} as const;

export function PageSkeleton({ page }: { page: keyof typeof descriptions }) {
  const [title, description] = descriptions[page];
  const admin = page === "users" || page === "buckets" || page === "accountBilling";
  const billing = page === "billing" || page === "bucketBilling" || page === "accountBilling";
  return (
    <section
      className={admin ? "space-y-6" : "px-6 py-8 lg:px-8"}
      aria-busy="true"
      aria-label={`Loading ${title}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {admin && !billing ? (
            <h2 className="text-lg font-semibold">{title}</h2>
          ) : (
            <h1 className="text-xl font-semibold">{title}</h1>
          )}
          {description && <p className="mt-2 text-sm text-kumo-subtle">{description}</p>}
        </div>
        {billing && (
          <p className="rounded-md border border-kumo-line px-3 py-2 text-sm text-kumo-subtle">
            Month to date · UTC
          </p>
        )}
      </header>
      <output className="sr-only">Loading {title.toLowerCase()}…</output>
      <div className="mt-6">
        {billing ? (
          <BillingSkeleton />
        ) : (
          <div className="space-y-4 motion-safe:animate-pulse" aria-hidden="true">
            {page === "metrics" || page === "objects" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className="h-[108px] rounded-lg border border-kumo-line bg-kumo-tint"
                  />
                ))}
              </div>
            ) : (
              <div className="h-9 w-64 max-w-full rounded bg-kumo-tint" />
            )}
            {page === "metrics" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className="h-[382px] rounded-lg border border-kumo-line bg-kumo-tint"
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-kumo-line">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className="flex h-14 items-center gap-6 border-b border-kumo-line px-4 last:border-0"
                  >
                    <div className="h-4 w-1/3 rounded bg-kumo-tint" />
                    <div className="h-4 w-1/5 rounded bg-kumo-tint" />
                    <div className="h-4 w-1/6 rounded bg-kumo-tint" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { CopyValue } from "./copy-value";
import { ThemeToggle } from "./theme-toggle";

function useRoute() {
  const path = usePathname();
  const parts = path.split("/").filter(Boolean);
  return {
    path,
    parts,
    bucket: parts[0] === "buckets" && parts[1] !== "new" ? parts[1] : undefined,
  };
}

export function RouteNavigation({ auth, tabs }: { auth: React.ReactNode; tabs: React.ReactNode }) {
  const { bucket } = useRoute();
  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-kumo-line px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 text-sm text-kumo-subtle">
          {bucket ? (
            <>
              <Link href="/" className="shrink-0">
                R2 Object Storage
              </Link>
              <span aria-hidden="true">›</span>
              <CopyValue value={decodeURIComponent(bucket)} label="bucket name" alwaysVisible />
            </>
          ) : (
            "R2 Object Storage"
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {auth}
        </div>
      </header>
      {tabs}
    </>
  );
}

const home = {
  "/": "Overview",
  "/analytics": "Metrics",
  "/api-keys": "API Keys",
  "/billing": "Billing",
};
const sections = {
  "": "Objects",
  "/metrics": "Metrics",
  "/api-keys": "API Keys",
  "/billing": "Billing",
  "/settings": "Settings",
};

export function RouteTabs() {
  const { path, parts, bucket } = useRoute();
  const router = useRouter();
  const base = `/buckets/${bucket}`;
  const tabs = bucket
    ? Object.entries(sections).map(([s, label]) => ({
        label,
        href: base + s,
        active: s ? parts[2] === s.slice(1) : parts.length === 2 || parts[2] === "object",
      }))
    : path in home
      ? Object.entries(home).map(([href, label]) => ({ label, href, active: path === href }))
      : [];
  return (
    tabs.length > 0 && (
      <nav
        aria-label="R2 sections"
        className="flex h-[60px] items-center border-b border-kumo-line px-4"
      >
        <Tabs
          tabs={tabs.map((t) => ({ value: t.href, label: t.label }))}
          value={tabs.find((t) => t.active)?.href}
          onValueChange={(href) => router.push(href)}
        />
      </nav>
    )
  );
}

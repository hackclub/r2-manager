import { Suspense } from "react";
import Link from "next/link";
import { CloudflareLogo } from "@cloudflare/kumo/components/cloudflare-logo";
import { DatabaseIcon } from "@phosphor-icons/react/dist/ssr";
import { listBuckets } from "@/lib/buckets";
import { SidebarBuckets } from "./sidebar-buckets";
import { getAccess } from "@/lib/access";
import { AuthButton } from "./auth-button";
import { RouteNavigation, RouteTabs } from "./route-navigation";

async function UserBuckets() {
  const a = await getAccess();
  const buckets = a?.allowed ? await listBuckets(a.user.id) : [];
  return (
    buckets.length > 0 && (
      <SidebarBuckets buckets={buckets.map(({ name, status }) => ({ name, status }))} />
    )
  );
}

async function ShellBody({ children }: { children: React.ReactNode }) {
  const a = await getAccess();
  return (
    <>
      <RouteNavigation auth={<AuthButton signedIn={!!a} />} tabs={a && <RouteTabs />} />
      {children}
    </>
  );
}
const ext = (href: string, label: string) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-kumo-default underline">
    {label}
  </a>
);

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[minmax(0,1fr)] bg-kumo-base text-kumo-default md:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="sticky top-0 h-screen overflow-hidden hidden border-r border-kumo-line md:flex md:flex-col">
        <Link
          href="/"
          className="flex h-14 shrink-0 items-center gap-4 border-b border-kumo-line px-5"
        >
          <CloudflareLogo width={36} height={26} />
          <span className="text-sm font-medium">R2 Manager</span>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 text-xs text-kumo-subtle">Workspace</p>
          <nav className="mt-3 space-y-1 text-sm">
            <Link href="/" className="flex items-center gap-3 rounded-md bg-kumo-tint px-3 py-2">
              <DatabaseIcon size={16} /> R2 Buckets
            </Link>
          </nav>
          <Suspense fallback={null}>
            <UserBuckets />
          </Suspense>
        </div>
        <div className="border-t border-kumo-line px-5 py-4 text-xs text-kumo-subtle">
          Made by {ext("https://3kh0.net", "Rowan")} Source on{" "}
          {ext("https://github.com/hackclub/r2-manager", "GitHub")}
        </div>
      </aside>
      <div className="min-w-0">
        <Suspense fallback={null}>
          <ShellBody>{children}</ShellBody>
        </Suspense>
      </div>
    </div>
  );
}

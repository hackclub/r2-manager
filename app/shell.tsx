import { Suspense } from "react";
import Link from "next/link";
import { CloudflareLogo } from "@cloudflare/kumo/components/cloudflare-logo";
import { listBuckets } from "@/lib/buckets";
import { SidebarBuckets } from "./sidebar-buckets";
import { getAccess } from "@/lib/access";
import { AuthButton } from "./auth-button";
import { RouteNavigation, RouteTabs, WorkspaceNavigation } from "./route-navigation";

async function WorkspaceLinks() {
  return <WorkspaceNavigation admin={Boolean((await getAccess())?.admin)} />;
}

async function UserBuckets() {
  const a = await getAccess();
  const buckets = a?.allowed ? await listBuckets(a) : [];
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
      <RouteNavigation
        auth={
          <>
            <span className="md:hidden">
              {a?.admin && (
                <Link href="/admin" className="mr-2 text-sm hover:underline">
                  Admin
                </Link>
              )}
            </span>
            <AuthButton signedIn={!!a} />
          </>
        }
        tabs={a && <RouteTabs />}
      />
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
            <Suspense fallback={null}>
              <WorkspaceLinks />
            </Suspense>
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
        <Suspense
          fallback={
            <>
              <Suspense
                fallback={
                  <header className="flex h-14 items-center border-b border-kumo-line px-4 text-sm text-kumo-subtle sm:px-6">
                    R2 Object Storage
                  </header>
                }
              >
                <RouteNavigation auth={null} tabs={null} />
              </Suspense>
              {children}
            </>
          }
        >
          <ShellBody>{children}</ShellBody>
        </Suspense>
      </div>
    </div>
  );
}

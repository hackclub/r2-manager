import { Suspense } from "react";
import { getAccess } from "@/lib/access";
import { listBuckets } from "@/lib/buckets";
import { AuthButton } from "./auth-button";
import { BucketList } from "./bucket-list";
import { CreateBucketDialog } from "./create-bucket-dialog";

const notice = "mt-8 rounded-lg border border-kumo-line bg-kumo-tint p-6";

async function Dashboard() {
  const access = await getAccess();
  const buckets = access?.allowed ? await listBuckets(access.user.id) : [];
  return (
    <div className="flex flex-col xl:flex-row">
      <main className="min-w-0 flex-1 px-6 py-8 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-kumo-strong">R2 Object Storage</h1>
              <a
                href="https://developers.cloudflare.com/r2/"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-kumo-line px-2 py-0.5 text-xs"
              >
                View docs
              </a>
            </div>
            <p className="mt-2 text-sm text-kumo-subtle">
              High-performance storage for files and objects with zero egress charges.
            </p>
          </div>
          {access?.allowed && <CreateBucketDialog />}
        </div>
        {!access ? (
          <section className={notice}>
            <h2 className="font-semibold">Sign in to continue</h2>
            <p className="my-3 text-sm text-kumo-subtle">
              Use your Hack Club account to access your buckets.
            </p>
            <AuthButton signedIn={false} />
          </section>
        ) : !access.allowed ? (
          <section className={notice}>
            <h2 className="font-semibold">Access required</h2>
            <p className="mt-2 text-sm text-kumo-subtle">
              Access is automatic for verified @hackclub.com emails. For other accounts, give the
              administrator your Hack Club Auth ID:
            </p>
            <code className="mt-3 block break-all text-sm">{access.subject ?? "Unavailable"}</code>
          </section>
        ) : (
          <BucketList
            buckets={buckets.map((b) => ({ ...b, created_at: b.created_at.toISOString() }))}
          />
        )}
      </main>
      {access?.allowed && (
        <aside className="w-full shrink-0 border-t border-kumo-line p-6 xl:w-[310px] xl:border-l xl:border-t-0">
          <h2 className="font-medium">Your R2 buckets</h2>
          <div className="mt-5 flex justify-between border-b border-kumo-line pb-4 text-sm">
            <span className="text-kumo-subtle">Buckets created</span>
            <span>{buckets.length}</span>
          </div>
          <div className="mt-6 rounded-lg border border-kumo-line bg-kumo-elevated p-4 text-sm">
            <h3 className="font-medium">Get started</h3>
            <p className="mt-2 text-kumo-subtle">
              Create a bucket, upload files, and create an API key for your apps.
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
export default function Home() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}

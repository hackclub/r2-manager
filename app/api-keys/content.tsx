import { db } from "@/lib/db";
import { ownedKeyBuckets, listOwnedKeys } from "@/lib/api-keys";
import { account, cloudflareConfigured, r2Endpoint } from "@/lib/cloudflare";
import { ApiKeysPanel } from "@/app/buckets/[name]/api-keys/panel";

export async function KeyContent({ owner, bucket = "" }: { owner: string; bucket?: string }) {
  const [buckets, keys, writable] = await Promise.all([
    ownedKeyBuckets(owner),
    listOwnedKeys(owner),
    db.query<{ bucket_name: string }>(
      "SELECT bucket_name FROM bucket_members WHERE user_id=$1 AND role IN ('editor','manager')",
      [owner],
    ),
  ]);
  return (
    <main className="px-6 py-8 lg:px-8">
      <ApiKeysPanel
        bucket={bucket}
        buckets={buckets}
        writableBuckets={writable.rows.map((r) => r.bucket_name)}
        keys={keys}
        configured={cloudflareConfigured()}
        endpoint={account ? r2Endpoint : ""}
        now={Date.now()}
      />
    </main>
  );
}

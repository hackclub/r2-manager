import { ownedKeyBuckets, listOwnedKeys } from "@/lib/api-keys";
import { account, cloudflareConfigured, r2Endpoint } from "@/lib/cloudflare";
import { ApiKeysPanel } from "@/app/buckets/[name]/api-keys/panel";

export async function KeyContent({ owner, bucket = "" }: { owner: string; bucket?: string }) {
  const [buckets, keys] = await Promise.all([ownedKeyBuckets(owner), listOwnedKeys(owner)]);
  return (
    <main className="px-6 py-8 lg:px-8">
      <ApiKeysPanel
        bucket={bucket}
        buckets={buckets}
        keys={keys}
        configured={cloudflareConfigured()}
        endpoint={account ? r2Endpoint : ""}
        now={Date.now()}
      />
    </main>
  );
}

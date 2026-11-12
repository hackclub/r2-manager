import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CodeBlock } from "@cloudflare/kumo/components/code";
import { PageSkeleton } from "@/app/page-skeleton";
import { CopyValue } from "@/app/copy-value";
import { getAccess } from "@/lib/access";
import { listConnections } from "@/lib/mcp/grants";
import { mcpResource } from "@/lib/mcp/resource";
import { Connections } from "./connections";

const clients = [
  {
    name: "Claude Code",
    lang: "bash",
    code: `claude mcp add --transport http r2-manager ${mcpResource}`,
  },
  {
    name: "Cursor, VS Code, and other JSON configs",
    lang: "jsonc",
    code: JSON.stringify({ mcpServers: { "r2-manager": { url: mcpResource } } }, null, 2),
  },
] as const;

async function Mcp() {
  const access = await getAccess();
  if (!access) redirect("/");
  const connections = await listConnections(access.user.id);
  return (
    <main className="px-6 py-8 lg:px-8">
      <h1 className="text-xl font-semibold">MCP</h1>
      <p className="mt-2 max-w-2xl text-sm text-kumo-subtle">
        Let AI assistants browse and manage your buckets. Connected apps sign in as you, ask for
        your approval, and can never do more than your bucket roles allow.
      </p>
      <section className="mt-6 max-w-3xl space-y-5 rounded-lg border border-kumo-line p-5">
        <div>
          <h2 className="text-sm font-medium">Server URL</h2>
          <div className="mt-2 rounded-md border border-kumo-line bg-kumo-tint px-3 py-2 font-mono">
            <CopyValue value={mcpResource} label="server URL" alwaysVisible />
          </div>
          <p className="mt-2 text-sm text-kumo-subtle">
            In Claude, add it under Settings → Connectors → Add custom connector. No API key is
            needed; you approve each app in your browser.
          </p>
        </div>
        {clients.map((c) => (
          <div key={c.name}>
            <h2 className="mb-2 text-sm font-medium">{c.name}</h2>
            <CodeBlock code={c.code} lang={c.lang} />
          </div>
        ))}
      </section>
      <h2 className="mt-10 font-medium">Connected apps</h2>
      <p className="mt-1 text-sm text-kumo-subtle">
        Disconnecting an app stops it immediately and signs it out everywhere.
      </p>
      <Connections connections={connections} />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton page="mcp" />}>
      <Mcp />
    </Suspense>
  );
}

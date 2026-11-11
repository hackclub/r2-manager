"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { formatBytes, bucketHref } from "@/lib/format";
import Link from "next/link";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Table } from "@cloudflare/kumo/components/table";
import { browsable } from "./sidebar-buckets";

type Bucket = { name: string; status: string; created_at: string };

export function BucketList({ buckets }: { buckets: Bucket[] }) {
  const [sizes, setSizes] = useState<Record<string, number | null>>({});
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/bucket-sizes", { signal: c.signal })
      .then((r) => (r.ok ? r.json() : {}))
      .then(setSizes)
      .catch(() => {});
    return () => c.abort();
  }, [buckets]);
  const q = (useSearchParams().get("q") ?? "").slice(0, 64);
  const [draft, setDraft] = useState(q);
  const [previous, setPrevious] = useState(q);
  if (previous !== q) {
    setPrevious(q);
    setDraft(q);
  }
  const filtered = buckets.filter((b) => b.name.includes(q.toLowerCase()));

  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (draft) url.searchParams.set("q", draft.slice(0, 64));
    else url.searchParams.delete("q");
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
  }

  return (
    <>
      <form className="mt-8 flex gap-2" onSubmit={search}>
        <Input
          name="q"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search buckets..."
          aria-label="Search buckets"
          className="min-w-0 flex-1"
        />
        <Button
          variant="secondary"
          type="submit"
          aria-label="Search buckets"
          icon={<MagnifyingGlassIcon />}
        />
      </form>
      <div className="mt-6 overflow-hidden rounded-lg border border-kumo-line">
        <Table aria-label="Buckets" className="w-full text-left text-sm">
          <Table.Header>
            <Table.Row className="text-kumo-subtle">
              {["Buckets", "Created", "Size", "Status"].map((h) => (
                <Table.Head key={h} className="px-4 py-3 font-normal">
                  {h}
                </Table.Head>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filtered.map(({ name, status, created_at }) => (
              <Table.Row key={name} className="border-t border-kumo-line bg-kumo-elevated">
                <Table.Cell className="px-4 py-3">
                  {browsable(status) ? (
                    <Link href={bucketHref(name)} prefetch={false} className="text-kumo-link">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </Table.Cell>
                <Table.Cell className="px-4 py-3 text-kumo-subtle">
                  {new Date(created_at).toISOString().slice(0, 10)}
                </Table.Cell>
                <Table.Cell className="w-28 px-4 py-3 tabular-nums">
                  {formatBytes(sizes[name])}
                </Table.Cell>
                <Table.Cell className="px-4 py-3">
                  {{ active: "Active", unassigned: "Unassigned" }[status] ?? "Needs review"}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        {filtered.length === 0 && (
          <p className="border-t border-kumo-line bg-kumo-elevated p-8 text-center text-sm text-kumo-subtle">
            {q
              ? "No buckets match your search."
              : "No buckets yet. Create a bucket to get started."}
          </p>
        )}
      </div>
    </>
  );
}

"use client";
import { useState, useTransition, useOptimistic } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { Table } from "@cloudflare/kumo/components/table";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import {
  InfoIcon,
  FolderIcon,
  FileIcon,
  MagnifyingGlassIcon,
  ArrowsClockwiseIcon,
  DotsThreeIcon,
  CaretUpDownIcon,
} from "@phosphor-icons/react";
import { formatBytes, bucketHref } from "@/lib/format";
import { Upload, UploadProvider } from "./upload";
import { FolderForm } from "./folder-form";
import { CopyValue } from "./copy-value";
import { useDeleteObject } from "./delete-object-button";

type Entry = {
  key: string;
  size: number;
  last_modified?: string;
  storage_class?: string;
  http_metadata?: { contentType?: string };
};
type Row = Entry & { folder: boolean };
const types: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  json: "application/json",
  pdf: "application/pdf",
  txt: "text/plain",
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  zip: "application/zip",
};
const fileType = (r: Row) =>
  r.folder
    ? "Folder"
    : r.http_metadata?.contentType || types[r.key.split(".").pop()?.toLowerCase() || ""] || "File";
const sortValue: Record<string, (r: Row) => string | number> = {
  key: (r) => r.key,
  type: fileType,
  storage: (r) => r.storage_class || "Standard",
  size: (r) => r.size,
  modified: (r) => r.last_modified || "",
};
const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});
export function ObjectBrowser({
  bucket,
  prefix,
  folders,
  objects,
  cursor,
  asFolders,
  canWrite,
}: {
  bucket: string;
  prefix: string;
  folders: string[];
  objects: Entry[];
  cursor?: string;
  asFolders: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [folderView, setFolderView] = useOptimistic(asFolders);
  const [pending, start] = useTransition();
  const [query, setQuery] = useState(prefix);
  const [previous, setPrevious] = useState(prefix);
  if (previous !== prefix) {
    setPrevious(prefix);
    setQuery(prefix);
  }
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState({ column: "key", desc: false });
  const [message, setMessage] = useState("");
  const del = useDeleteObject(bucket, () => router.refresh());
  const busy = pending || del.pending;
  const rows: Row[] = [
    ...folders.map((key) => ({ key, size: 0, folder: true })),
    ...objects.filter((o) => o.key !== prefix).map((o) => ({ ...o, folder: false })),
  ].sort((a, b) => {
    if (a.folder !== b.folder) return a.folder ? -1 : 1;
    const [x, y] = [a, b].map(sortValue[sort.column]);
    return (
      (typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y))) * (sort.desc ? -1 : 1)
    );
  });
  const visible = rows.filter((r) => selected.has(r.key));
  const base = bucketHref(bucket);
  function href(next: string, flat = !asFolders, page?: string) {
    const q = new URLSearchParams({
      ...(next && { prefix: next }),
      ...(flat && { folders: "false" }),
      ...(page && { cursor: page }),
    });
    return base + (q.size ? `?${q}` : "");
  }
  const rowHref = (r: Row) =>
    r.folder ? href(r.key) : `${base}/object?${new URLSearchParams({ key: r.key })}`;
  function go(url: string, before?: () => void) {
    setSelected(new Set());
    start(() => {
      before?.();
      router.push(url, { scroll: false });
    });
  }
  async function copy(paths: string[]) {
    setMessage(
      await Promise.resolve()
        .then(() => navigator.clipboard.writeText(paths.join("\n")))
        .then(
          () => "Copied",
          () => "Unable to copy.",
        ),
    );
  }
  const directory = prefix.endsWith("/") ? prefix : prefix.slice(0, prefix.lastIndexOf("/") + 1);
  const crumbs = directory.split("/").filter(Boolean);
  return (
    <UploadProvider
      key={`${bucket}:${canWrite}`}
      bucket={bucket}
      prefix={directory}
      enabled={canWrite}
    >
      <section aria-label="Objects" className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-kumo-line pb-5">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go(href(query));
            }}
          >
            <Input
              label="Search objects by prefix"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-64 sm:w-80"
            />
            <Button type="submit" variant="secondary" icon={<MagnifyingGlassIcon />} loading={busy}>
              Search
            </Button>
          </form>
          <div className="flex items-center gap-2">
            <Checkbox
              label="View prefixes as folders"
              checked={folderView}
              disabled={busy}
              onCheckedChange={(checked) =>
                go(href(prefix, !checked), () => setFolderView(checked))
              }
            />
            <Tooltip
              content="R2 stores objects in a flat structure. Folders group objects by the prefixes in their names. Turn this off to show full object keys."
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="About prefixes as folders"
                  icon={<InfoIcon />}
                />
              }
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <nav
            aria-label="Object path"
            className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-kumo-subtle"
          >
            <Link href={href("")} className="underline underline-offset-4">
              {bucket}
            </Link>
            {crumbs.map((part, i) => (
              <span key={i}>
                {" "}
                /{" "}
                <Link
                  href={href(crumbs.slice(0, i + 1).join("/") + "/")}
                  className="underline underline-offset-4"
                >
                  {part}
                </Link>
              </span>
            ))}
            <span className="[&>div>span:first-child]:hidden">
              <CopyValue value={prefix || bucket} label="object path" />
            </span>
          </nav>
          <div className="flex items-start gap-2">
            {!canWrite && (
              <span className="self-center text-xs text-kumo-subtle">
                Viewer access · read only
              </span>
            )}
            {canWrite && (
              <>
                <Upload />
                <FolderForm bucket={bucket} prefix={directory} />
              </>
            )}
            <Button
              aria-label="Refresh objects"
              variant="secondary"
              icon={<ArrowsClockwiseIcon />}
              loading={busy}
              onClick={() => start(() => router.refresh())}
            />
          </div>
        </div>
        {visible.length > 0 && (
          <div className="mb-3 flex items-center gap-3 text-sm">
            <span>{visible.length} selected</span>
            <Button size="sm" variant="secondary" onClick={() => copy(visible.map((r) => r.key))}>
              Copy paths
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        )}
        {message && <output className="mb-3 block text-sm">{message}</output>}
        <div className="overflow-x-auto rounded-lg border border-kumo-line" aria-busy={busy}>
          <Table aria-label="Objects" className="w-full text-left text-sm">
            <Table.Header>
              <Table.Row>
                <Table.Head className="w-10 px-3">
                  <Checkbox
                    aria-label="Select all objects on this page"
                    checked={rows.length > 0 && visible.length === rows.length}
                    onCheckedChange={(checked) =>
                      setSelected(checked ? new Set(rows.map((r) => r.key)) : new Set())
                    }
                  />
                </Table.Head>
                {[
                  ["key", "Objects"],
                  ["type", "Type"],
                  ["storage", "Storage Class"],
                  ["size", "Size"],
                  ["modified", "Modified"],
                ].map(([column, label]) => (
                  <Table.Head
                    key={column}
                    aria-sort={
                      sort.column === column ? (sort.desc ? "descending" : "ascending") : "none"
                    }
                    className="px-3 py-2"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 text-kumo-subtle"
                      onClick={() =>
                        setSort({ column, desc: sort.column === column ? !sort.desc : false })
                      }
                    >
                      {label}
                      <CaretUpDownIcon size={12} />
                    </Button>
                  </Table.Head>
                ))}
                <Table.Head className="w-12">
                  <span className="sr-only">Actions</span>
                </Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row
                  key={row.key}
                  className="border-t border-kumo-line bg-kumo-base hover:bg-kumo-tint/40"
                >
                  <Table.Cell className="px-3 py-2">
                    <Checkbox
                      aria-label={`Select ${row.key}`}
                      checked={selected.has(row.key)}
                      onCheckedChange={(checked) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (checked) next.add(row.key);
                          else next.delete(row.key);
                          return next;
                        })
                      }
                    />
                  </Table.Cell>
                  <Table.Cell className="max-w-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      {row.folder ? (
                        <FolderIcon className="shrink-0 text-kumo-subtle" size={16} />
                      ) : (
                        <FileIcon className="shrink-0 text-kumo-subtle" size={16} />
                      )}
                      <Link
                        href={rowHref(row)}
                        prefetch={false}
                        title={row.key}
                        className="truncate text-kumo-default underline decoration-kumo-line underline-offset-4 hover:text-kumo-link"
                      >
                        {row.key.slice(directory.length) || row.key}
                      </Link>
                    </div>
                  </Table.Cell>
                  <Table.Cell
                    className="px-3 py-2 text-kumo-subtle"
                    title={
                      !row.folder && !row.http_metadata?.contentType
                        ? "Type inferred from filename"
                        : ""
                    }
                  >
                    {fileType(row)}
                  </Table.Cell>
                  <Table.Cell className="px-3 py-2 text-kumo-subtle">
                    {row.folder
                      ? "—"
                      : row.storage_class === "InfrequentAccess"
                        ? "Infrequent Access"
                        : row.storage_class || "Standard"}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap px-3 py-2 tabular-nums text-kumo-subtle">
                    {row.folder ? "—" : formatBytes(row.size)}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap px-3 py-2 text-kumo-subtle">
                    {row.last_modified ? dateTime.format(new Date(row.last_modified)) : "—"}
                  </Table.Cell>
                  <Table.Cell className="px-2">
                    <DropdownMenu>
                      <DropdownMenu.Trigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Actions for ${row.key}`}
                            icon={<DotsThreeIcon />}
                          />
                        }
                      />
                      <DropdownMenu.Content>
                        <DropdownMenu.LinkItem href={rowHref(row)}>
                          {row.folder ? "Open folder" : "View details"}
                        </DropdownMenu.LinkItem>
                        <DropdownMenu.Item onClick={() => copy([row.key])}>
                          Copy path
                        </DropdownMenu.Item>
                        {!row.folder && (
                          <>
                            <DropdownMenu.LinkItem
                              href={`/api${base}/download?${new URLSearchParams({ key: row.key })}`}
                            >
                              Download
                            </DropdownMenu.LinkItem>
                            {canWrite && (
                              <DropdownMenu.Item
                                variant="danger"
                                onClick={() => del.open(row.key)}
                                disabled={busy}
                              >
                                Delete object
                              </DropdownMenu.Item>
                            )}
                          </>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          {!rows.length && (
            <div className="p-6">
              {canWrite ? (
                <Upload dropzone />
              ) : (
                <p className="text-sm text-kumo-subtle">No objects found.</p>
              )}
            </div>
          )}
        </div>
        {!rows.length && !cursor && objects.some((o) => o.key === prefix) && (
          <Button
            className="mt-3"
            variant="secondary-destructive"
            onClick={() => del.open(prefix)}
            loading={busy}
          >
            Delete empty folder
          </Button>
        )}
        {cursor && (
          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={() => go(href(prefix, !asFolders, cursor))}
              loading={busy}
            >
              Next page
            </Button>
          </div>
        )}
        {del.dialog}
      </section>
    </UploadProvider>
  );
}

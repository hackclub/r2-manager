"use client";
import { bucketHref } from "@/lib/format";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DatabaseIcon } from "@phosphor-icons/react";

/** Buckets that can be opened; pending ones need administrator review. */
export const browsable = (status: string) => status === "active" || status === "unassigned";

export function SidebarBuckets({ buckets }: { buckets: { name: string; status: string }[] }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Your buckets"
      className="mt-2 space-y-1 border-l border-kumo-line pl-2 text-sm ml-5"
    >
      {buckets.map(({ name, status }) => {
        const href = bucketHref(name);
        const active = path === href || path.startsWith(`${href}/`);
        return browsable(status) ? (
          <Link
            key={name}
            href={href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            title={name}
            className={`flex min-w-0 items-center gap-2 rounded-md px-3 py-2 ${active ? "bg-kumo-tint text-kumo-default" : "text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default"}`}
          >
            <DatabaseIcon size={14} className="shrink-0" />
            <span className="truncate">{name}</span>
          </Link>
        ) : (
          <div key={name} className="px-3 py-2 text-kumo-subtle" title={name}>
            <span className="block truncate">{name}</span>
            <span className="text-xs">Needs review</span>
          </div>
        );
      })}
    </nav>
  );
}

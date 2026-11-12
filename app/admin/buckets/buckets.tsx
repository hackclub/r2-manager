"use client";

import Link from "next/link";
import { useState } from "react";
import { AssignmentForm, RemoveMemberButton, MemberRoleForm } from "../forms";
import { EmptyState, ListControls, Status } from "../list-controls";

import type { BucketRole } from "@/lib/bucket-policy";

type Bucket = {
  name: string;
  status: "assigned" | "unassigned" | "retired";
  members: { id: string; name: string; email: string; role: BucketRole }[];
};

export function Buckets({
  buckets,
  users,
}: {
  buckets: Bucket[];
  users: { id: string; name: string; email: string }[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const search = query.trim().toLowerCase();
  const visible = buckets.filter(
    (b) =>
      (filter === "all" || b.status === filter) &&
      [b.name, ...b.members.flatMap((m) => [m.name, m.email])].some((v) =>
        v?.toLowerCase().includes(search),
      ),
  );
  const labels = { assigned: "Assigned", unassigned: "Unassigned", retired: "Retired name" };
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          Buckets{" "}
          <span className="ml-1 text-sm font-normal text-kumo-subtle">{buckets.length}</span>
        </h2>
        <p className="mt-1 text-sm text-kumo-subtle">
          Manage the people who can access each bucket.
        </p>
      </div>
      <div className="rounded-xl border border-kumo-line bg-kumo-elevated p-5 text-sm">
        <p className="font-medium">Choose the access each person needs</p>
        <p className="mt-1 text-kumo-subtle">
          Viewers can read objects. Editors can also upload and delete objects. Managers can change
          settings, empty, and delete buckets. People must sign in at least once. Administrators
          always have full access. Manage app access on the{" "}
          <Link href="/admin/users" className="text-kumo-default underline">
            Users page
          </Link>
          .
        </p>
      </div>
      <ListControls
        query={query}
        onQueryChange={setQuery}
        placeholder="Search bucket or person"
        filter={filter}
        onFilterChange={setFilter}
        options={[
          { value: "all", label: `All (${buckets.length})` },
          ...(["unassigned", "assigned", "retired"] as const).map((value) => ({
            value,
            label: `${labels[value]} (${buckets.filter((b) => b.status === value).length})`,
          })),
        ]}
      />
      <section aria-label="Buckets" className="overflow-hidden rounded-xl border border-kumo-line">
        <output className="block border-b border-kumo-line bg-kumo-tint px-5 py-3 text-xs text-kumo-subtle">
          Showing {visible.length} of {buckets.length} buckets
        </output>
        <ul className="divide-y divide-kumo-line">
          {visible.map((b) => (
            <li
              key={b.name}
              className="flex flex-col justify-between gap-4 p-5 xl:flex-row xl:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-all font-mono text-sm font-medium">{b.name}</p>
                  <Status active={b.status === "assigned"}>{labels[b.status]}</Status>
                </div>
                {b.members.length > 0 && (
                  <ul className="mt-3 space-y-2" aria-label={`People with access to ${b.name}`}>
                    {b.members.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center gap-3 text-sm">
                        <span>
                          {m.name} <span className="break-all text-kumo-subtle">· {m.email}</span>
                        </span>
                        <MemberRoleForm key={m.role} bucket={b.name} user={m} />
                        <RemoveMemberButton bucket={b.name} user={m} />
                      </li>
                    ))}
                  </ul>
                )}
                {b.status === "assigned" && !b.members.length && (
                  <p className="mt-2 text-sm text-kumo-subtle">Only administrators have access.</p>
                )}
                {b.status === "retired" && (
                  <p className="mt-2 text-sm text-kumo-subtle">
                    This name was retired. Manual reconciliation is required before it can be
                    assigned.
                  </p>
                )}
              </div>
              {b.status !== "retired" && (
                <div className="min-w-0 xl:max-w-lg">
                  {users.length ? (
                    <AssignmentForm
                      key={b.members.map((m) => m.id).join(",")}
                      bucket={b.name}
                      users={users.filter((u) => !b.members.some((m) => m.id === u.id))}
                    />
                  ) : (
                    <p className="text-sm text-kumo-subtle">
                      No people available. A user must sign in first.
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {!visible.length && (
          <EmptyState
            title={buckets.length ? "No matching buckets" : "No buckets yet"}
            description={
              buckets.length
                ? "Try a different search or status filter."
                : "Existing Cloudflare buckets will appear here when available."
            }
          />
        )}
      </section>
    </div>
  );
}

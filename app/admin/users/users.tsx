"use client";

import { useState } from "react";
import { AccessForm, PromoteButton } from "../forms";
import { EmptyState, ListControls, Status } from "../list-controls";

type User = {
  subject: string;
  name: string;
  email: string | null;
  admin: boolean;
  allowed: boolean;
};

export function Users({ users }: { users: User[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const search = query.trim().toLowerCase();
  const visible = users.filter(
    (u) =>
      (filter === "all" ||
        (filter === "admins" ? u.admin : filter === "allowed" ? u.allowed : !u.allowed)) &&
      [u.name, u.email, u.subject].some((v) => v?.toLowerCase().includes(search)),
  );
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          Users <span className="ml-1 text-sm font-normal text-kumo-subtle">{users.length}</span>
        </h2>
        <p className="mt-1 text-sm text-kumo-subtle">
          Control who can use R2 Manager and manage the workspace.
        </p>
      </div>
      <section
        aria-labelledby="grant-access"
        className="rounded-xl border border-kumo-line bg-kumo-elevated p-5"
      >
        <h3 id="grant-access" className="text-sm font-semibold">
          Grant access
        </h3>
        <p className="mt-1 mb-4 text-sm text-kumo-subtle">
          Enter a Hack Club Auth ID. The user must sign in once before you can assign them a bucket.
        </p>
        <AccessForm />
      </section>
      <ListControls
        query={query}
        onQueryChange={setQuery}
        placeholder="Search name, email, or Auth ID"
        filter={filter}
        onFilterChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "allowed", label: "Allowed" },
          { value: "blocked", label: "Blocked" },
          { value: "admins", label: "Admins" },
        ]}
      />
      <section aria-label="Users" className="overflow-hidden rounded-xl border border-kumo-line">
        <output className="block border-b border-kumo-line bg-kumo-tint px-5 py-3 text-xs text-kumo-subtle">
          Showing {visible.length} of {users.length} users
        </output>
        <ul className="divide-y divide-kumo-line">
          {visible.map((u) => (
            <li
              key={u.subject}
              className="flex flex-col justify-between gap-4 p-5 xl:flex-row xl:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words text-sm font-medium">{u.name}</p>
                  <Status active={u.allowed}>
                    {u.admin ? "Administrator" : u.allowed ? "Allowed" : "Blocked"}
                  </Status>
                </div>
                {u.email && <p className="mt-1 break-all text-sm text-kumo-subtle">{u.email}</p>}
                <p className="mt-1 break-all text-xs text-kumo-subtle">
                  Auth ID: <span className="font-mono">{u.subject}</span>
                </p>
              </div>
              {!u.admin && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <AccessForm subject={u.subject} allowed={u.allowed} />
                  <PromoteButton
                    subject={u.subject}
                    name={u.name === "Not signed in yet" ? u.subject : u.name}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
        {!visible.length && (
          <EmptyState
            title={users.length ? "No matching users" : "No users yet"}
            description={
              users.length
                ? "Try a different search or status filter."
                : "Grant access above to add your first user."
            }
          />
        )}
      </section>
      <p className="text-xs text-kumo-subtle">
        Verified @hackclub.com accounts have access automatically unless blocked. Revoking access
        also disables the user’s API keys.
      </p>
    </div>
  );
}

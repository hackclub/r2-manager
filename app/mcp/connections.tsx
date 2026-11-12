"use client";
import { useState, useTransition } from "react";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Table } from "@cloudflare/kumo/components/table";
import { ConfirmDialog, attempt } from "@/app/confirm-dialog";
import { EmptyState } from "@/app/admin/list-controls";
import type { Connection } from "@/lib/mcp/grants";
import { disconnectApp } from "./actions";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const access = (c: Connection) =>
  c.scopes.includes("r2:write")
    ? "Read / write"
    : c.scopes.includes("r2:read")
      ? "Read only"
      : "No bucket access";

export function Connections({ connections }: { connections: Connection[] }) {
  const [target, setTarget] = useState<Connection | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="mt-4 overflow-x-auto rounded-lg border border-kumo-line">
      {connections.length ? (
        <Table aria-label="Connected apps" className="w-full text-sm">
          <Table.Header>
            <Table.Row>
              <Table.Head className="px-4 py-3">App</Table.Head>
              <Table.Head>Access</Table.Head>
              <Table.Head>Connected</Table.Head>
              <Table.Head>
                <span className="sr-only">Actions</span>
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {connections.map((c) => (
              <Table.Row key={c.clientId} className="border-t border-kumo-line">
                <Table.Cell className="px-4 py-4">
                  <p className="font-medium">{c.name}</p>
                  <p className="mt-1 text-xs text-kumo-subtle">
                    {c.redirectHosts.length ? `Returns to ${c.redirectHosts.join(", ")}` : c.uri}
                  </p>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{access(c)}</Badge>
                    {c.scopes.includes("offline_access") && (
                      <Badge variant="outline">Stays signed in</Badge>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                  {day.format(new Date(c.connectedAt))}
                </Table.Cell>
                <Table.Cell className="pr-4 text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setError("");
                      setTarget(c);
                    }}
                  >
                    Disconnect
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <EmptyState
          title="No connected apps"
          description="Apps you approve will appear here, and you can disconnect them at any time."
        />
      )}
      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setTarget(null)}
        title={`Disconnect ${target?.name}?`}
        description="It loses access right away. To use it again, you will need to approve it again."
        confirmLabel="Disconnect"
        pending={pending}
        error={error}
        onConfirm={() =>
          start(async () => {
            const message = await attempt(
              () => disconnectApp(target!.clientId),
              "Could not disconnect the app. Try again.",
            );
            setError(message);
            if (!message) setTarget(null);
          })
        }
      />
    </section>
  );
}

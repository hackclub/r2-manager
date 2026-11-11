"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table } from "@cloudflare/kumo/components/table";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { ConfirmDialog } from "./confirm-dialog";
import { changeCustomDomain } from "./settings-actions";
export type CustomDomain = {
  domain: string;
  enabled?: boolean;
  minTLS?: string;
  status?: { ownership?: string; ssl?: string };
  reservation?: string;
};
export function DomainTable({
  bucket,
  domains,
  unavailable,
}: {
  bucket: string;
  domains: CustomDomain[];
  unavailable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const initializing = domains.some(
    ({ status: s }) =>
      s && (s.ownership === "pending" || s.ssl === "pending" || s.ssl === "initializing"),
  );
  useEffect(() => {
    if (!initializing) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") start(() => router.refresh());
    }, 15000);
    return () => clearInterval(t);
  }, [initializing, router]);
  const run = (domain: string, op: string) =>
    start(async () => {
      const report = op === "remove" ? setError : setMessage;
      try {
        const r = await changeCustomDomain(bucket, domain, op);
        report(r || "");
        if (!r) {
          setTarget(null);
          router.refresh();
        }
      } catch {
        report(op === "remove" ? "Unable to remove domain." : "Unable to update domain.");
      }
    });
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-kumo-line">
      <Table className="w-full text-sm">
        <Table.Header>
          <Table.Row>
            <Table.Head>Domain</Table.Head>
            <Table.Head>Minimum TLS</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Access</Table.Head>
            <Table.Head>
              <span className="sr-only">Actions</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {domains.map((d) => {
            const states = [d.status?.ownership, d.status?.ssl];
            const [status, variant]: [string, "secondary" | "success" | "error" | "info"] =
              unavailable || !d.status
                ? ["Status unavailable", "secondary"]
                : states.every((x) => x === "active")
                  ? ["Active", "success"]
                  : states.some((x) => x === "error" || x === "failed" || x === "blocked")
                    ? ["Failed", "error"]
                    : d.status.ownership === "deactivated"
                      ? ["Deactivated", "secondary"]
                      : ["Initializing", "info"];
            return (
              <Table.Row key={d.domain}>
                <Table.Cell className="py-4">{d.domain}</Table.Cell>
                <Table.Cell>{d.minTLS || "—"}</Table.Cell>
                <Table.Cell>
                  <Badge variant={variant}>{status}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={d.enabled === true ? "success" : "secondary"}>
                    {d.enabled === true ? "Enabled" : d.enabled === false ? "Disabled" : "Unknown"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {d.status && (
                    <DropdownMenu>
                      <DropdownMenu.Trigger
                        render={
                          <Button
                            variant="ghost"
                            aria-label={`Actions for ${d.domain}`}
                            icon={<DotsThreeIcon />}
                            disabled={pending}
                          />
                        }
                      />
                      <DropdownMenu.Content>
                        <DropdownMenu.Item
                          onClick={() => run(d.domain, d.enabled ? "disable" : "enable")}
                        >
                          {d.enabled ? "Disable domain" : "Enable domain"}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          variant="danger"
                          onClick={() => {
                            setError("");
                            setTarget(d.domain);
                          }}
                        >
                          Remove domain
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  )}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
      {!domains.length && (
        <p className="p-4 text-sm text-kumo-subtle">
          {unavailable ? "Unable to load custom domains." : "No custom domains connected."}
        </p>
      )}
      {message && <output className="block p-4 text-sm">{message}</output>}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        onConfirm={() => {
          if (target) run(target, "remove");
        }}
        title="Remove custom domain?"
        description={
          <>
            Disconnect <strong>{target}</strong> from this bucket? Apps using this address will lose
            access.
          </>
        }
        confirmLabel="Remove domain"
        pending={pending}
        error={error}
      />
    </div>
  );
}

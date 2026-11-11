"use client";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Table } from "@cloudflare/kumo/components/table";
import { CheckCircleIcon, SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { emptyBucket, type EmptyBucketResult } from "./object-actions";
import { jobState as state } from "@/lib/format";

type Job = { id: string; jobType: string; status: string; startTime: string };
const started = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const Icon = ({ s, size }: { s?: string; size: number }) =>
  s === "running" ? (
    <SpinnerGapIcon size={size} className="motion-safe:animate-spin" />
  ) : s === "completed" ? (
    <CheckCircleIcon size={size} />
  ) : (
    <WarningCircleIcon size={size} />
  );

export function EmptyBucketForm({
  name,
  jobs = [],
  historyUnavailable = false,
}: {
  name: string;
  jobs?: Job[];
  historyUnavailable?: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [result, action, pending] = useActionState(
    async (previous: EmptyBucketResult | null, form: FormData) => {
      const r = await emptyBucket(previous, form);
      if (r.state !== "error") setConfirmation("");
      return r;
    },
    null,
  );
  const [polled, setPolled] = useState<{ source: Job[]; jobs: Job[] } | null>(null);
  const [pollError, setPollError] = useState("");
  const list = polled?.source === jobs ? polled.jobs : jobs;
  const job = list.find((j) => j.id === result?.jobId);
  const current = job ? state(job.status) : result?.state;
  const active =
    list.some((j) => state(j.status) === "running") || (result?.state === "running" && !job);
  useEffect(() => {
    if (!active) return;
    const c = new AbortController();
    let busy = false;
    async function refresh() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const r = await fetch(`/api/buckets/${encodeURIComponent(name)}/jobs`, {
          signal: c.signal,
          cache: "no-store",
        });
        const data = r.ok ? await r.json() : null;
        if (!Array.isArray(data?.jobs)) throw new Error();
        setPolled({ source: jobs, jobs: data.jobs });
        setPollError("");
      } catch {
        if (!c.signal.aborted)
          setPollError("Could not refresh job progress. Retrying automatically…");
      } finally {
        busy = false;
      }
    }
    void refresh();
    const t = setInterval(refresh, 5000);
    return () => {
      c.abort();
      clearInterval(t);
    };
  }, [active, name, jobs]);
  const message =
    current === "completed"
      ? "Emptying job completed."
      : current === "failed"
        ? "The emptying job did not complete. Check its status below."
        : result?.message;
  const success = !pending && current === "completed",
    failure = !pending && (current === "failed" || current === "error");
  return (
    <div>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="bucket" value={name} />
        <Input
          name="confirmation"
          label={`Type EMPTY ${name} to confirm`}
          required
          autoComplete="off"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary-destructive"
            type="submit"
            loading={pending}
            disabled={active || confirmation !== `EMPTY ${name}`}
          >
            Empty bucket
          </Button>
          {(pending || message) && (
            <output
              className={`inline-flex items-center gap-2 text-sm ${success ? "text-kumo-success" : failure ? "text-kumo-danger" : "text-kumo-subtle"}`}
            >
              <Icon s={pending ? "running" : current} size={17} />
              <span>{pending ? "Starting emptying job…" : message}</span>
            </output>
          )}
        </div>
      </form>
      {pollError && <p className="mt-3 text-xs text-kumo-subtle">{pollError}</p>}
      {list.length > 0 && (
        <section className="mt-5 overflow-hidden rounded-lg border border-kumo-line">
          <h4 className="border-b border-kumo-line px-4 py-3 text-sm font-medium">Recent jobs</h4>
          <div className="overflow-x-auto">
            <Table className="w-full text-sm" aria-label="Recent bucket jobs">
              <Table.Header>
                <Table.Row>
                  <Table.Head className="px-4 py-2">Operation</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head>Started</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {list.map((j) => {
                  const s = state(j.status);
                  return (
                    <Table.Row key={j.id} className="border-t border-kumo-line">
                      <Table.Cell className="px-4 py-3">
                        {j.jobType === "prefixDelete" ? "Delete objects" : j.jobType}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          variant={
                            s === "completed" ? "success" : s === "failed" ? "error" : "info"
                          }
                        >
                          <Icon s={s} size={12} />{" "}
                          {s === "completed"
                            ? "Completed"
                            : s === "failed"
                              ? j.status.toLowerCase().replace(/^./, (c) => c.toUpperCase())
                              : "In progress"}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                        {started.format(new Date(j.startTime))} UTC
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </div>
        </section>
      )}
      {!list.length && historyUnavailable && (
        <p className="mt-4 text-xs text-kumo-subtle">Job history is temporarily unavailable.</p>
      )}
    </div>
  );
}

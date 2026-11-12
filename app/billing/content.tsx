import Link from "next/link";
import { Suspense } from "react";
import {
  billingPeriod,
  ownedBills,
  accountBills,
  billsForBuckets,
  type bucketBill,
} from "@/lib/billing";
import { money } from "@/lib/billing-cost";
import { formatBytes, formatCount, bucketHref } from "@/lib/format";
import { InfoTip } from "@/app/info-tip";
import {
  KumoTable as Table,
  KumoTableHeader as Header,
  KumoTableBody as Body,
  KumoTableRow as Row,
  KumoTableHead as TableHead,
  KumoTableCell as Cell,
} from "@/app/kumo-table";

type BillingScope = { owner: string } | { bucket: string } | { account: true };

export function BillingContent({ scope }: { scope: BillingScope }) {
  const account = "account" in scope;
  return (
    <section className={`space-y-8 ${account ? "" : "px-6 py-8 lg:px-8"}`}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Billing</h1>
          <p className="mt-2 text-sm text-kumo-subtle">
            {"bucket" in scope
              ? `Usage and estimated cost for ${scope.bucket}.`
              : account
                ? "Usage and estimated cost for all buckets in the Cloudflare account, including unassigned buckets."
                : "Usage and estimated cost for buckets currently assigned to you."}{" "}
            {account
              ? "Estimates are before shared allowances and rounding; this is not a Cloudflare invoice."
              : "This is not a bill or invoice, R2 is free for your work :)"}
          </p>
        </div>
        <p className="rounded-md border border-kumo-line px-3 py-2 text-sm text-kumo-subtle">
          Month to date · UTC
        </p>
      </header>
      <Suspense
        fallback={
          <div
            className="min-h-82.5 rounded-lg border border-kumo-line bg-kumo-base"
            aria-label="Loading billing usage"
            aria-busy="true"
          />
        }
      >
        <Usage scope={scope} />
      </Suspense>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">R2 rates</h2>
          <a
            className="text-sm text-kumo-link"
            href="https://developers.cloudflare.com/r2/pricing/"
            target="_blank"
            rel="noreferrer"
          >
            View Cloudflare pricing
          </a>
        </div>
        <div className="overflow-x-auto rounded-lg border border-kumo-line">
          <Table>
            <Header>
              <Row>
                <TableHead>Usage</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Infrequent Access</TableHead>
              </Row>
            </Header>
            <Body>
              {[
                ["Storage", "$0.015 / GB-month", "$0.01 / GB-month"],
                ["Class A operations", "$4.50 / million", "$9.00 / million"],
                ["Class B operations", "$0.36 / million", "$0.90 / million"],
                ["Data retrieval", "Free", "$0.01 / GB"],
                ["Internet egress", "Free", "Free"],
              ].map((row) => (
                <Row key={row[0]}>
                  {row.map((value, i) => (
                    <Cell key={i}>{value}</Cell>
                  ))}
                </Row>
              ))}
            </Body>
          </Table>
        </div>
      </section>
    </section>
  );
}
async function Usage({ scope }: { scope: BillingScope }) {
  const rows = await ("bucket" in scope
    ? billsForBuckets([scope.bucket])
    : "owner" in scope
      ? ownedBills(scope.owner)
      : accountBills());
  if (!rows.length)
    return (
      <section className="flex min-h-82.5 flex-col items-center justify-center rounded-lg border border-kumo-line p-6 text-center">
        <h2 className="font-medium">{"owner" in scope ? "No assigned buckets" : "No buckets"}</h2>
        <p className="mt-2 text-sm text-kumo-subtle">
          Your bucket usage and cost breakdown will appear here.
        </p>
        <Link className="mt-4 text-sm text-kumo-link" href="/">
          View R2 buckets
        </Link>
      </section>
    );
  const bills = rows.flatMap((r) => (r.bill ? [r.bill] : []));
  const incomplete = rows.length - bills.filter((b) => b.storageComplete).length;
  const total = (f: (b: Bill) => number) =>
    bills.length ? money(bills.reduce((n, b) => n + f(b), 0)) : "—";
  const start = billingPeriod().start.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const summaries = [
    ["Recorded usage estimate", total((b) => b.total)],
    ["Storage", total((b) => b.cost.storage)],
    ["Operations", total((b) => b.cost.a + b.cost.b)],
    ["Data retrieval", total((b) => b.cost.retrieval)],
  ];
  return (
    <section className="min-h-82.5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map(([label, value]) => (
          <div className="rounded-lg border border-kumo-line p-5" key={label}>
            <div className="flex items-center gap-2 text-sm text-kumo-subtle">
              {label}
              {label === "Recorded usage estimate" && (
                <InfoTip label="usage estimate">
                  Since {start}, before shared allowances and rounding. Incomplete data contributes
                  only its recorded usage.
                </InfoTip>
              )}
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      {!!incomplete && (
        <output className="text-sm text-kumo-subtle">
          Usage is incomplete for {incomplete} of {rows.length} buckets. Totals include only
          available measurements.
        </output>
      )}
      <div className="overflow-x-auto rounded-lg border border-kumo-line">
        <Table>
          <Header>
            <Row>
              <TableHead>Bucket</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>Class A</TableHead>
              <TableHead>Class B</TableHead>
              <TableHead>Retrieval</TableHead>
              <TableHead>Estimated cost</TableHead>
            </Row>
          </Header>
          <Body>
            {rows.map(({ name, bill }) => (
              <Row key={name}>
                <Cell>
                  <Link className="text-kumo-link" href={bucketHref(name)}>
                    {name}
                  </Link>
                </Cell>
                <Cost
                  cost={bill?.storageAvailable ? bill.cost.storage : undefined}
                  empty={<span className="text-kumo-subtle">Pending data</span>}
                >
                  {bill &&
                    `${(bill.usage.Standard.gbMonths + bill.usage.InfrequentAccess.gbMonths).toLocaleString("en-US", { maximumFractionDigits: 3 })} GB-month`}
                </Cost>
                <Cost cost={bill?.cost.a}>
                  {bill &&
                    `${formatCount(bill.usage.Standard.a + bill.usage.InfrequentAccess.a)} requests`}
                </Cost>
                <Cost cost={bill?.cost.b}>
                  {bill &&
                    `${formatCount(bill.usage.Standard.b + bill.usage.InfrequentAccess.b)} requests`}
                </Cost>
                <Cost cost={bill?.cost.retrieval}>
                  {bill && formatBytes(bill.usage.InfrequentAccess.retrieved)}
                </Cost>
                <Cell className="font-medium tabular-nums">
                  {bill ? money(bill.total) : "Unavailable"}
                  {bill && !bill.storageComplete && (
                    <p className="mt-1 text-xs font-normal text-kumo-subtle">Partial estimate</p>
                  )}
                </Cell>
              </Row>
            ))}
          </Body>
        </Table>
      </div>
    </section>
  );
}
type Bill = NonNullable<Awaited<ReturnType<typeof bucketBill>>>;
function Cost({
  cost,
  empty = "—",
  children,
}: {
  cost?: number;
  empty?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Cell>
      {cost == null ? (
        empty
      ) : (
        <>
          <p>{money(cost)}</p>
          <p className="mt-1 text-xs text-kumo-subtle">{children}</p>
        </>
      )}
    </Cell>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { money } from "@/lib/billing-cost";
import { formatBytes, formatCount, bucketHref } from "@/lib/format";
import { sortBills, type BillingRow, type BillingSortKey } from "@/lib/billing-sort";
import {
  KumoTable as Table,
  KumoTableHeader as Header,
  KumoTableBody as Body,
  KumoTableRow as Row,
  KumoTableHead as TableHead,
  KumoTableCell as Cell,
} from "@/app/kumo-table";

const columns = [
  ["name", "Bucket"],
  ["storage", "Storage"],
  ["a", "Class A"],
  ["b", "Class B"],
  ["retrieval", "Retrieval"],
  ["total", "Estimated cost"],
] as const;

export function BillingTable({ rows }: { rows: BillingRow[] }) {
  const [sort, setSort] = useState<{ key: BillingSortKey; descending: boolean }>({
    key: "name",
    descending: false,
  });
  const sorted = sortBills(rows, sort.key, sort.descending);
  return (
    <div className="overflow-x-auto rounded-lg border border-kumo-line">
      <Table>
        <Header>
          <Row>
            {columns.map(([key, label]) => (
              <TableHead
                key={key}
                aria-sort={
                  sort.key === key ? (sort.descending ? "descending" : "ascending") : "none"
                }
              >
                <button
                  type="button"
                  className="-m-2 flex w-full items-center gap-2 rounded p-2 text-left hover:text-kumo-link focus-visible:outline-2 focus-visible:outline-kumo-brand"
                  onClick={() =>
                    setSort({
                      key,
                      descending: sort.key === key ? !sort.descending : key !== "name",
                    })
                  }
                >
                  {label}
                  <span aria-hidden="true" className={sort.key === key ? "" : "text-kumo-subtle"}>
                    {sort.key === key ? (sort.descending ? "↓" : "↑") : "↕"}
                  </span>
                </button>
              </TableHead>
            ))}
          </Row>
        </Header>
        <Body>
          {sorted.map(({ name, bill }) => (
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
  );
}
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

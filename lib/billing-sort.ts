import type { bucketBill } from "./billing";

export type BillingRow = { name: string; bill: Awaited<ReturnType<typeof bucketBill>> };
export type BillingSortKey = "name" | "storage" | "a" | "b" | "retrieval" | "total";

export function sortBills(rows: BillingRow[], key: BillingSortKey, descending: boolean) {
  const value = ({ bill }: BillingRow) =>
    !bill || (key === "storage" && !bill.storageAvailable)
      ? null
      : key === "total"
        ? bill.total
        : bill.cost[key as keyof typeof bill.cost];
  return [...rows].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name) * (descending ? -1 : 1);
    const av = value(a);
    const bv = value(b);
    if (av == null || bv == null)
      return av == null ? (bv == null ? a.name.localeCompare(b.name) : 1) : -1;
    return (av - bv) * (descending ? -1 : 1) || a.name.localeCompare(b.name);
  });
}

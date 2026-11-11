export const rates = {
  Standard: { storage: 0.015, a: 4.5, b: 0.36, retrieval: 0 },
  InfrequentAccess: { storage: 0.01, a: 9, b: 0.9, retrieval: 0.01 },
};
type Usage = { gbMonths: number; a: number; b: number; retrieved: number };
export type StorageClass = keyof typeof rates;
export const emptyUsage = (): Usage => ({ gbMonths: 0, a: 0, b: 0, retrieved: 0 });
export function usageCost(usage: Usage, storage: StorageClass) {
  const rate = rates[storage];
  return {
    storage: usage.gbMonths * rate.storage,
    a: (usage.a / 1e6) * rate.a,
    b: (usage.b / 1e6) * rate.b,
    retrieval: (usage.retrieved / 1e9) * rate.retrieval,
  };
}
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const money = (value: number) =>
  value > 0 && value < 0.01 ? "<$0.01" : dollars.format(value);

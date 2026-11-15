import { round, sum, ratio, days, money, metric, notice } from "./lib.mjs";
export const config = {
  slug: "profit-safe-pricing",
  title: "Profit-Safe Pricing Calculator",
  description:
    "Check price floors and discount headroom before making an offer.",
  scope:
    "A local planning workspace. Review suggestions before acting; no automatic messages or financial transactions.",
  method:
    "After-discount profit subtracts direct cost, allocated overhead, and percentage fees. Minimum price = cost / (1 − fee rate − target margin). Required margin plus fee rate must stay below 100%.",
  port: 4426,
  asOf: "2026-11-15",
  fields: [
    {
      key: "name",
      label: "Product / service",
      type: "text",
    },
    {
      key: "unitCost",
      label: "Direct cost per unit",
      type: "number",
      min: 0,
      max: 100000000,
    },
    {
      key: "overhead",
      label: "Allocated overhead per unit",
      type: "number",
      min: 0,
      max: 100000000,
    },
    {
      key: "price",
      label: "List price per unit",
      type: "number",
      min: 0,
      max: 100000000,
    },
    {
      key: "discount",
      label: "Proposed discount (%)",
      type: "number",
      min: 0,
      max: 100,
    },
  ],
  settings: [
    {
      key: "currency",
      label: "Currency code (one currency per workspace)",
      type: "text",
      maxLength: 3,
    },
    {
      key: "targetMargin",
      label: "Required margin (%)",
      type: "number",
      min: 0,
      max: 99,
    },
    {
      key: "feeRate",
      label: "Payment / platform fee (%)",
      type: "number",
      min: 0,
      max: 99,
    },
  ],
  actions: [],
  document: false,
};
config.validate = function validate(records, s) {
  if (s.targetMargin + s.feeRate >= 100)
    throw new Error("Target margin plus fees must be below 100%");
};
export const example = {
  schemaVersion: 1,
  project: "profit-safe-pricing",
  settings: {
    currency: "USD",
    targetMargin: 20,
    feeRate: 3,
  },
  records: [
    {
      id: "price-1",
      name: "Maintenance plan",
      unitCost: 50,
      overhead: 10,
      price: 100,
      discount: 10,
    },
    {
      id: "price-2",
      name: "Starter package",
      unitCost: 80,
      overhead: 10,
      price: 100,
      discount: 20,
    },
  ],
};
export function analyze(records, s) {
  const belowTarget = new Set(
    records
      .filter((r) => {
        const revenue = r.price * (1 - r.discount / 100);
        const cost = r.unitCost + r.overhead + (revenue * s.feeRate) / 100;
        return (
          revenue === 0 || ((revenue - cost) / revenue) * 100 < s.targetMargin
        );
      })
      .map((r) => r.id),
  );

  const rows = records.map((r) => {
    const cost = r.unitCost + r.overhead,
      net = r.price * (1 - r.discount / 100),
      profit = net * (1 - s.feeRate / 100) - cost,
      floor = cost / (1 - (s.feeRate + s.targetMargin) / 100),
      headroom = r.price ? 100 * (1 - floor / r.price) : null;
    return {
      id: r.id,
      Offer: r.name,
      "Selling price": money(net),
      "Profit / unit": money(profit),
      "Margin (%)": ratio(profit, net) ?? "N/A",
      "Minimum price": money(Math.ceil((floor - 1e-9) * 100) / 100),
      "Max discount (%)":
        headroom === null
          ? "N/A"
          : headroom < 0
            ? "Raise list price"
            : Math.floor(headroom * 100) / 100,
    };
  });
  return {
    metrics: [
      metric("Offers evaluated", rows.length),
      metric("Below target", rows.filter((r) => belowTarget.has(r.id)).length),
      metric("Required margin (%)", s.targetMargin),
    ],
    notices: rows
      .filter((r) => belowTarget.has(r.id))
      .map((r) =>
        notice(
          r.id,
          `${r.Offer}: review pricing before sending this offer.`,
          "warning",
        ),
      ),
    columns: [
      "Offer",
      "Selling price",
      "Profit / unit",
      "Margin (%)",
      "Minimum price",
      "Max discount (%)",
    ],
    rows,
  };
}

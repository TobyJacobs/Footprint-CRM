// Purchasing summary for a sales order (DJ, 11 November 2026): for each item,
// how many we need, how many are ordered from suppliers, how many are only on
// draft purchase orders, and how many still need ordering. Kept apart from the
// database so it can be checked on its own.
//
// Purchase order lines are matched to the order's lines by product, or by the
// first line of the description when there's no product.

export type SummaryOrderLine = { product_id: string | null; description: string; quantity: number; boughtIn: boolean };
export type SummaryPoLine = {
  product_id: string | null;
  description: string;
  quantity: number;
  bought_quantity: number | null;
  line_net: number;
  actual_line_net: number | null;
  unit_cost: number;
  status: string; // the purchase order's status
};

export type SummaryRow = {
  item: string;
  needed: number;
  ordered: number; // on sent / received / closed POs (what was actually bought, if recorded)
  draft: number; // only on draft POs so far
  toOrder: number; // still to put on a purchase order
  boughtIn: boolean; // false = not something we buy from a supplier
};

const ORDERED = ["sent", "received", "closed"];
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const firstLine = (d: string) => d.split("\n")[0].trim().toLowerCase();
const keyOf = (l: { product_id: string | null; description: string }) => (l.product_id ? `p:${l.product_id}` : `d:${firstLine(l.description)}`);

export function purchasingSummary(orderLines: SummaryOrderLine[], poLines: SummaryPoLine[]) {
  // Totals per item on the POs (cancelled ones don't count).
  const onPos = new Map<string, { ordered: number; draft: number }>();
  for (const l of poLines) {
    if (l.status === "cancelled") continue;
    const t = onPos.get(keyOf(l)) ?? { ordered: 0, draft: 0 };
    if (l.status === "draft") t.draft += l.quantity;
    else if (ORDERED.includes(l.status)) t.ordered += l.bought_quantity ?? l.quantity;
    onPos.set(keyOf(l), t);
  }

  // Order lines with the same item are added together.
  const rows: SummaryRow[] = [];
  const seen = new Map<string, SummaryRow>();
  for (const l of orderLines) {
    const k = keyOf(l);
    const existing = seen.get(k);
    if (existing) {
      existing.needed = round3(existing.needed + l.quantity);
      existing.boughtIn = existing.boughtIn || l.boughtIn;
      continue;
    }
    const row: SummaryRow = { item: l.description.split("\n")[0].trim() || "Item", needed: l.quantity, ordered: 0, draft: 0, toOrder: 0, boughtIn: l.boughtIn };
    seen.set(k, row);
    rows.push(row);
  }
  for (const [k, row] of seen) {
    const t = onPos.get(k);
    if (t) {
      row.ordered = round3(t.ordered);
      row.draft = round3(t.draft);
      row.boughtIn = true; // it's on a PO, so it's bought in
    }
    row.toOrder = row.boughtIn ? Math.max(0, round3(row.needed - row.ordered - row.draft)) : 0;
  }

  // Money across the POs: what it should cost (for what was bought) vs what we paid.
  const live = poLines.filter((l) => l.status !== "cancelled");
  const withActual = live.filter((l) => l.actual_line_net !== null);
  const shouldCost = round2(live.reduce((s, l) => s + (l.bought_quantity !== null ? l.bought_quantity * l.unit_cost : l.line_net), 0));
  const boughtFor = withActual.length ? round2(withActual.reduce((s, l) => s + (l.actual_line_net ?? 0), 0)) : null;
  const boughtForShould = round2(withActual.reduce((s, l) => s + (l.bought_quantity !== null ? l.bought_quantity * l.unit_cost : l.line_net), 0));

  return {
    rows,
    stillToOrder: rows.filter((r) => r.toOrder > 0).length,
    shouldCost,
    boughtFor,
    // Over (+) or under (−) on the lines we have bought-for figures for.
    difference: boughtFor === null ? null : round2(boughtFor - boughtForShould),
    pricedLines: withActual.length,
    totalLines: live.length,
  };
}

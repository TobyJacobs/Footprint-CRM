// Part billing (owner, 26 October 2026): the sums behind a part invoice.
// Kept apart from the database so they can be checked on their own.

import { gbp } from "@/lib/customers/display";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PartRequest = { rest: true } | { rest?: false; amount: number; unit: "gbp" | "percent" };
export type PartLine = { tax_rate_id: string | null; tax_rate: number; net: number; cost: number };
export type PartPlan =
  | { ok: false; error: string }
  | { ok: true; bill: number; share: number; isFinal: boolean; partNo: number; percent: number; lines: (PartLine & { amount: number })[] };

// orderLines: the order's lines (net before VAT); already: what's been
// invoiced so far before VAT; invoiceCount: how many invoices so far.
export function planPartInvoice(
  orderLines: { tax_rate_id: string | null; tax_rate: number; line_net: number }[],
  order: { net: number; cost: number },
  already: number,
  invoiceCount: number,
  req: PartRequest,
): PartPlan {
  if (order.net <= 0) return { ok: false, error: "This order has nothing to invoice" };
  const remaining = round2(order.net - already);
  if (remaining <= 0) return { ok: false, error: "This order has already been fully invoiced" };

  let bill: number;
  if (req.rest) bill = remaining;
  else if (!(req.amount > 0)) return { ok: false, error: "Please enter an amount or a percentage to invoice" };
  else bill = req.unit === "percent" ? round2((order.net * req.amount) / 100) : round2(req.amount);
  if (bill > remaining + 0.005) return { ok: false, error: `That's more than is left to invoice (${gbp(remaining)} before VAT)` };

  // One line per VAT rate, in proportion; the last takes any rounding so the
  // lines add up to exactly the amount billed.
  const groups = new Map<string, { tax_rate_id: string | null; tax_rate: number; net: number }>();
  for (const l of orderLines) {
    const key = `${l.tax_rate_id}|${l.tax_rate}`;
    const g = groups.get(key) ?? { tax_rate_id: l.tax_rate_id, tax_rate: Number(l.tax_rate), net: 0 };
    g.net = round2(g.net + Number(l.line_net));
    groups.set(key, g);
  }
  const parts = [...groups.values()].filter((g) => g.net !== 0);
  const share = bill / order.net;
  const amounts = parts.map((g) => round2(g.net * share));
  if (amounts.length) amounts[amounts.length - 1] = round2(bill - amounts.slice(0, -1).reduce((a, b) => a + b, 0));

  return {
    ok: true,
    bill,
    share,
    isFinal: bill >= remaining - 0.005,
    partNo: invoiceCount + 1,
    percent: Math.round(share * 1000) / 10,
    lines: parts.map((g, i) => ({ ...g, cost: round2(order.cost * (g.net / order.net) * share), amount: amounts[i] })),
  };
}

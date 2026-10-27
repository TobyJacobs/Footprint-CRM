// Shared definitions for quotes, sales orders and invoices.

export type DocType = "quote" | "sales_order" | "invoice" | "credit_note";

export const docTypes: Record<DocType, { label: string; plural: string; path: string }> = {
  quote: { label: "Quote", plural: "Quotes", path: "/sales/quotes" },
  sales_order: { label: "Sales order", plural: "Sales orders", path: "/sales/orders" },
  invoice: { label: "Invoice", plural: "Invoices", path: "/sales/invoices" },
  credit_note: { label: "Credit note", plural: "Credit notes", path: "/sales/credit-notes" },
};

export function isDocType(v: unknown): v is DocType {
  return v === "quote" || v === "sales_order" || v === "invoice" || v === "credit_note";
}

// Documents that are legal records once issued: never deleted, only voided.
export function isLockedRecord(type: DocType, status: string) {
  return (type === "invoice" || type === "credit_note") && status !== "draft";
}

// Statuses per document type, in the order they normally happen.
export const statuses: Record<DocType, { value: string; label: string }[]> = {
  quote: [
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "accepted", label: "Accepted" },
    { value: "declined", label: "Declined" },
    { value: "converted", label: "Converted to order" },
  ],
  sales_order: [
    { value: "open", label: "Open" },
    { value: "completed", label: "Completed" },
    { value: "invoiced", label: "Invoiced" },
    { value: "cancelled", label: "Cancelled" },
  ],
  invoice: [
    { value: "draft", label: "Draft" },
    { value: "issued", label: "Issued" },
    { value: "paid", label: "Paid" },
    { value: "void", label: "Void" },
  ],
  credit_note: [
    { value: "draft", label: "Draft" },
    { value: "issued", label: "Issued" },
    { value: "void", label: "Void" },
  ],
};

export const defaultStatus: Record<DocType, string> = {
  quote: "draft",
  sales_order: "open",
  invoice: "draft",
  credit_note: "draft",
};

export const creditReasons = [
  "Goods returned",
  "Damaged or faulty",
  "Pricing error",
  "Goodwill gesture",
  "Cancelled order",
  "Duplicate invoice",
  "Other",
];

// Recurring invoices
export const frequencies = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "six_monthly", label: "Every 6 months" },
  { value: "annually", label: "Annually" },
];
export const frequencyLabel = (f: string) => frequencies.find((x) => x.value === f)?.label ?? f;
export const recurringStatuses = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

// Maps the billing frequency words used on hosting plans to ours.
export function frequencyFromHosting(billing: string | null | undefined) {
  switch (billing) {
    case "Quarterly":
      return "quarterly";
    case "6 Monthly":
    case "Bi Annual":
      return "six_monthly";
    case "Annually":
      return "annually";
    default:
      return "monthly";
  }
}

// Purchase orders
export const poStatuses = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent to supplier" },
  { value: "received", label: "Received" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

export function poStatusLabel(status: string) {
  return poStatuses.find((s) => s.value === status)?.label ?? status;
}

export function statusLabel(type: DocType, status: string) {
  return statuses[type].find((s) => s.value === status)?.label ?? status;
}

export function statusToneFor(status: string) {
  if (["accepted", "completed", "paid", "invoiced", "converted", "received", "closed"].includes(status)) return "teal" as const;
  if (["declined", "cancelled", "void"].includes(status)) return "red" as const;
  if (["sent", "issued", "open"].includes(status)) return "pink" as const;
  return "grey" as const;
}

// Footprint's own fields, worded as in Zoho Books.
// Orders, invoices, recurring invoices and products keep Zoho's list.
export const businessUnits = ["Print", "Account Sales", "Digital"];
// Quotes use Footprint's own business units (owner, 20 October 2026).
export const quoteBusinessUnits = ["Print/Merch", "Advertising", "Footprint AI", "Signage"];

// The three kinds of new opportunity (owner, 20 October 2026; Zoho CRM Deals
// weren't checked, so the details below are a first guess for the owner to review).
export const quoteKinds = [
  {
    value: "quote",
    label: "Quote",
    newLabel: "New quote",
    description: "A standard quote: print, merch, signage and products, priced line by line.",
  },
  {
    value: "advertising",
    label: "Advertising",
    newLabel: "New advertising quote",
    description: "Advert space in Forget Me Not: choose the size, editions and months, and the lines are filled in for you.",
  },
  {
    value: "proposal",
    label: "Proposal",
    newLabel: "New proposal",
    description: "A bigger piece of work (Footprint AI, websites, campaigns): overview, what we'll deliver, timeline and investment.",
  },
] as const;
export type QuoteKind = (typeof quoteKinds)[number]["value"];
export const isQuoteKind = (v: unknown): v is QuoteKind => quoteKinds.some((k) => k.value === v);
export const quoteKindLabel = (v: unknown) => quoteKinds.find((k) => k.value === v)?.label ?? "Quote";

// What a new proposal's notes start with, ready to fill in.
export const proposalTemplate = `Overview
What the customer wants to achieve, in a few lines.

What we'll deliver
- 
- 

Timeline
- Start: 
- Finish: 

Next steps
Accept this proposal online and we'll be in touch to get started.`;
export const probabilities = ["Low", "Confident", "Definite"];
export const expectedDates = ["This Month", "Next Month", "Future"];
// Footprint's warehouses: where an order goes out from or is collected from.
export const warehouses = ["Swanwick", "Swindon"] as const;
export const isWarehouse = (v: unknown): v is (typeof warehouses)[number] => warehouses.some((w) => w === v);
export const deliveryTypes = ["Direct to Customer", "Pick up from Footprint", "Swindon Office", "Footprint Delivery"];
export const lossReasons = ["Price", "Went Cold", "Just Exploring", "Requirements Not Met"];
export const productionSteps = [
  "New Sales Order",
  "With Design Team",
  "Proof with Customer",
  "Back With Matt",
  "Sales Order Awaiting Update",
];
export const units = ["each", "pack", "box", "hour", "sqm", "set", "month"];

// The same sums the database does, for live totals while editing.
export type LineInput = {
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  discount_percent: number;
  tax_rate: number;
  gp_override?: number | null;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineNet(l: LineInput) {
  return round2(l.quantity * l.unit_price * (1 - l.discount_percent / 100));
}

// A line's cost: quantity × unit cost, or (with a GP override) whatever makes
// its gross profit the override.
export function lineCost(l: LineInput) {
  return l.gp_override != null ? round2(lineNet(l) - l.gp_override) : round2(l.quantity * (l.unit_cost ?? 0));
}

// A line's gross profit (£, before VAT) and margin (% of its net).
export const lineGp = (l: LineInput) => round2(lineNet(l) - lineCost(l));
export const lineMargin = (l: LineInput) => marginPercent(lineNet(l), lineCost(l));

// The sell price per unit that gives a margin (%) on a unit cost, after the
// line's discount: price × (1 − discount) × (1 − margin) = cost. Null when it
// can't be worked out (no cost, or a margin of 100% or more).
export function priceForMargin(unitCost: number | null, marginPct: number, discountPct = 0) {
  if (unitCost === null || !(unitCost > 0) || !(marginPct < 100) || !(discountPct < 100)) return null;
  return round2(unitCost / ((1 - marginPct / 100) * (1 - discountPct / 100)));
}

export function totals(lines: LineInput[]) {
  let subtotal = 0;
  let vat = 0;
  let cost = 0;
  for (const l of lines) {
    const net = lineNet(l);
    subtotal += net;
    vat += round2((net * l.tax_rate) / 100);
    cost += lineCost(l);
  }
  subtotal = round2(subtotal);
  vat = round2(vat);
  cost = round2(cost);
  return { subtotal, vat, total: round2(subtotal + vat), cost, profit: round2(subtotal - cost) };
}

// Margin written in pounds and as a percentage, e.g. "£27.64 (58%)".
export function marginText(net: number, cost: number, formatMoney: (n: number) => string | null) {
  const pct = marginPercent(net, cost);
  return `${formatMoney(Math.round((net - cost) * 100) / 100) ?? ""}${pct === null ? "" : ` (${pct}%)`}`;
}

export function marginPercent(net: number, cost: number) {
  return net > 0 ? Math.round(((net - cost) / net) * 1000) / 10 : null;
}

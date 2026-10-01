// Shared definitions for quotes, sales orders and invoices.

export type DocType = "quote" | "sales_order" | "invoice";

export const docTypes: Record<DocType, { label: string; plural: string; path: string }> = {
  quote: { label: "Quote", plural: "Quotes", path: "/sales/quotes" },
  sales_order: { label: "Sales order", plural: "Sales orders", path: "/sales/orders" },
  invoice: { label: "Invoice", plural: "Invoices", path: "/sales/invoices" },
};

export function isDocType(v: unknown): v is DocType {
  return v === "quote" || v === "sales_order" || v === "invoice";
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
};

export const defaultStatus: Record<DocType, string> = {
  quote: "draft",
  sales_order: "open",
  invoice: "draft",
};

export function statusLabel(type: DocType, status: string) {
  return statuses[type].find((s) => s.value === status)?.label ?? status;
}

export function statusToneFor(status: string) {
  if (["accepted", "completed", "paid", "invoiced", "converted"].includes(status)) return "teal" as const;
  if (["declined", "cancelled", "void"].includes(status)) return "red" as const;
  if (["sent", "issued", "open"].includes(status)) return "pink" as const;
  return "grey" as const;
}

// Footprint's own fields, worded as in Zoho Books.
export const businessUnits = ["Print", "Account Sales", "Digital"];
export const probabilities = ["Low", "Confident", "Definite"];
export const expectedDates = ["This Month", "Next Month", "Future"];
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
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineNet(l: LineInput) {
  return round2(l.quantity * l.unit_price * (1 - l.discount_percent / 100));
}

export function totals(lines: LineInput[]) {
  let subtotal = 0;
  let vat = 0;
  let cost = 0;
  for (const l of lines) {
    const net = lineNet(l);
    subtotal += net;
    vat += round2((net * l.tax_rate) / 100);
    cost += round2(l.quantity * (l.unit_cost ?? 0));
  }
  subtotal = round2(subtotal);
  vat = round2(vat);
  cost = round2(cost);
  return { subtotal, vat, total: round2(subtotal + vat), cost, profit: round2(subtotal - cost) };
}

export function marginPercent(net: number, cost: number) {
  return net > 0 ? Math.round(((net - cost) / net) * 1000) / 10 : null;
}

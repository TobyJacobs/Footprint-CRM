import "server-only";
import { addDaysTo, addMonthsTo, ukToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { marginPercent } from "@/lib/sales/options";

// The Reports tab (Wave 7). Money is counted as on the Dashboards: invoices
// issued or paid, before VAT, less issued credit notes. Each report has a date
// range (with "same period last year") and a CSV download.

export const presets = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_3", label: "Last 3 months" },
  { key: "last_12", label: "Last 12 months" },
  { key: "this_year", label: "This year" },
  { key: "last_year", label: "Last year" },
  { key: "custom", label: "Choose dates" },
] as const;

export type Period = { preset: string; from: string; to: string; label: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const monthEnd = (ym: string) => addDaysTo(`${addMonthsTo(ym, 1)}-01`, -1);

// The range from the page address (?period=…&from=…&to=…), last 12 months by default.
export function periodFrom(sp: Record<string, string | string[] | undefined>, fallback = "last_12"): Period {
  const today = ukToday();
  const ym = today.slice(0, 7);
  const key = typeof sp.period === "string" && presets.some((p) => p.key === sp.period) ? sp.period : fallback;
  const label = presets.find((p) => p.key === key)?.label ?? "";
  switch (key) {
    case "this_month":
      return { preset: key, from: `${ym}-01`, to: today, label };
    case "last_month":
      return { preset: key, from: `${addMonthsTo(ym, -1)}-01`, to: monthEnd(addMonthsTo(ym, -1)), label };
    case "last_3":
      return { preset: key, from: `${addMonthsTo(ym, -2)}-01`, to: today, label };
    case "this_year":
      return { preset: key, from: `${today.slice(0, 4)}-01-01`, to: today, label };
    case "last_year": {
      const y = Number(today.slice(0, 4)) - 1;
      return { preset: key, from: `${y}-01-01`, to: `${y}-12-31`, label };
    }
    case "custom": {
      const from = typeof sp.from === "string" && ISO.test(sp.from) ? sp.from : `${ym}-01`;
      const to = typeof sp.to === "string" && ISO.test(sp.to) && sp.to >= from ? sp.to : today;
      return { preset: key, from, to, label: `${dayLabel(from)} to ${dayLabel(to)}` };
    }
    default:
      return { preset: "last_12", from: `${addMonthsTo(ym, -11)}-01`, to: today, label: "Last 12 months" };
  }
}

// The same dates a year earlier.
export const yearBefore = (p: Period) => ({
  from: `${Number(p.from.slice(0, 4)) - 1}${p.from.slice(4)}`,
  to: `${Number(p.to.slice(0, 4)) - 1}${p.to.slice(4)}`.replace(/-02-29$/, "-02-28"),
});

export const dayLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const periodQuery = (p: Period) => `period=${p.preset}${p.preset === "custom" ? `&from=${p.from}&to=${p.to}` : ""}`;
// Margin on cost, as everywhere (lib/sales/options).
export const marginOf = (net: number, cost: number) => marginPercent(net, cost);

// ─── Loaders ────────────────────────────────────────────────────────────────

export type SalesGroup = "month" | "salesperson" | "business_unit" | "account" | "customer";
export const salesGroups: { key: SalesGroup; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "salesperson", label: "Salesperson" },
  { key: "business_unit", label: "Business unit" },
  { key: "account", label: "Sales account" },
  { key: "customer", label: "Customer" },
];
export type SalesRow = { key: string; label: string; net: number; cost: number; docs: number };

export async function getSales(from: string, to: string, group: SalesGroup): Promise<SalesRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("report_sales", { p_from: from, p_to: to, p_group: group });
  return ((data ?? []) as SalesRow[]).map((r) => ({ ...r, net: Number(r.net), cost: Number(r.cost), docs: Number(r.docs) }));
}

export type DebtRow = {
  id: string;
  number: string;
  customer_id: string | null;
  customer_name: string | null;
  owner_name: string | null;
  issue_date: string;
  due_date: string | null;
  total: number;
  owed: number;
  daysOver: number;
  band: (typeof debtBands)[number]["key"];
};
export const debtBands = [
  { key: "current", label: "Not yet due" },
  { key: "d30", label: "1–30 days" },
  { key: "d60", label: "31–60 days" },
  { key: "d90", label: "61–90 days" },
  { key: "d90plus", label: "Over 90 days" },
] as const;

export async function getDebt(): Promise<DebtRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("report_debt");
  const today = ukToday();
  const days = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);
  return ((data ?? []) as Omit<DebtRow, "daysOver" | "band">[])
    .map((r) => {
      const owed = Number(r.owed);
      const over = r.due_date ? days(today, r.due_date) : 0;
      const band: DebtRow["band"] = over <= 0 ? "current" : over <= 30 ? "d30" : over <= 60 ? "d60" : over <= 90 ? "d90" : "d90plus";
      return { ...r, total: Number(r.total), owed, daysOver: Math.max(0, over), band };
    })
    .filter((r) => r.owed > 0.004);
}

export type CustomerRow = {
  id: string;
  name: string;
  net: number;
  cost: number;
  invoices: number;
  last_date: string;
  first_date: string | null;
  before_net: number;
  buys: string[] | null;
};
export type LostRow = { id: string; name: string; before_net: number; last_date: string };

export async function getCustomers(from: string, to: string): Promise<{ customers: CustomerRow[]; lost: LostRow[] }> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("report_customers", { p_from: from, p_to: to });
  const d = (data ?? { customers: [], lost: [] }) as { customers: CustomerRow[]; lost: LostRow[] };
  return {
    customers: d.customers.map((c) => ({ ...c, net: Number(c.net), cost: Number(c.cost), before_net: Number(c.before_net) })),
    lost: d.lost.map((l) => ({ ...l, before_net: Number(l.before_net) })),
  };
}

export type MagazineReport = {
  editions: { code: string; name: string; net: number; pages_booked: number; adverts: number; pages: number; target: number }[];
  months: { month: string; net: number; target: number; advertisers: number; new_advertisers: number }[];
  sizes: { size: string; adverts: number; net: number }[];
  salespeople: { name: string; adverts: number; net: number }[];
};

export async function getMagazineReport(from: string, to: string): Promise<MagazineReport> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("report_magazines", { p_from: from, p_to: to });
  const d = (data ?? { editions: [], months: [], sizes: [], salespeople: [] }) as MagazineReport;
  const n = <T extends Record<string, unknown>>(rows: T[], keys: (keyof T)[]) =>
    rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, keys.includes(k as keyof T) ? Number(v) : v])) as T);
  return {
    editions: n(d.editions, ["net", "pages_booked", "adverts", "pages", "target"]),
    months: n(d.months, ["net", "target", "advertisers", "new_advertisers"]),
    sizes: n(d.sizes, ["adverts", "net"]),
    salespeople: n(d.salespeople, ["adverts", "net"]),
  };
}

// ─── Magazine bookings (group 1 of the Mag Manager reports) ─────────────────

export type BookingRow = {
  line_id: string;
  month: string;
  edition_code: string;
  edition_name: string;
  customer_id: string | null;
  customer_name: string | null;
  category: string | null;
  section: string | null;
  size: string | null;
  premium_position: string | null;
  salesperson: string | null;
  net: number;
  pages: number;
  order_id: string;
  order_number: string;
  invoiced: boolean;
};

export type BookingGroup = "issue" | "month" | "edition" | "salesperson" | "customer" | "category" | "section" | "size" | "premium";
export const bookingGroups: { key: BookingGroup; label: string }[] = [
  { key: "issue", label: "Issue (edition and month)" },
  { key: "month", label: "Month" },
  { key: "edition", label: "Edition" },
  { key: "salesperson", label: "Salesperson" },
  { key: "customer", label: "Customer" },
  { key: "category", label: "Category" },
  { key: "section", label: "Section" },
  { key: "size", label: "Advert size" },
  { key: "premium", label: "Premium position" },
];

const monthName = (m: string) =>
  new Date(`${m.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

// The group a booking falls in: a sortable key and a label.
export function bookingKey(b: BookingRow, g: BookingGroup): [string, string] {
  switch (g) {
    case "issue":
      return [`${b.month}|${b.edition_code}`, `${b.edition_code}. ${b.edition_name} · ${monthName(b.month)}`];
    case "month":
      return [b.month, monthName(b.month)];
    case "edition":
      return [b.edition_code, `${b.edition_code}. ${b.edition_name}`];
    case "salesperson":
      return [b.salesperson ?? "~", b.salesperson ?? "No salesperson"];
    case "customer":
      return [b.customer_name ?? "~", b.customer_name ?? "Unknown customer"];
    case "category":
      return [b.category ?? "~", b.category ?? "No category"];
    case "section":
      return [b.section ?? "~", b.section ?? "No section"];
    case "size":
      return [b.size ?? "~", b.size ?? "No size"];
    case "premium":
      return [b.premium_position ?? "~", b.premium_position ?? "Not premium"];
  }
}

export type BookingSummary = { key: string; label: string; adverts: number; pages: number; net: number; customers: number; customerId: string | null };

export function summariseBookings(rows: BookingRow[], g: BookingGroup): BookingSummary[] {
  const map = new Map<string, BookingSummary & { ids: Set<string> }>();
  for (const b of rows) {
    const [key, label] = bookingKey(b, g);
    const s = map.get(key) ?? { key, label, adverts: 0, pages: 0, net: 0, customers: 0, customerId: g === "customer" ? b.customer_id : null, ids: new Set<string>() };
    s.adverts += 1;
    s.pages += b.pages;
    s.net += b.net;
    if (b.customer_id) s.ids.add(b.customer_id);
    map.set(key, s);
  }
  const list = [...map.values()].map(({ ids, ...s }) => ({ ...s, customers: ids.size }));
  // Time and editions in order; everything else biggest first.
  return ["issue", "month", "edition"].includes(g) ? list.sort((a, b) => a.key.localeCompare(b.key)) : list.sort((a, b) => b.net - a.net);
}

export async function getBookings(from: string, to: string): Promise<BookingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("report_bookings", { p_from: from, p_to: to });
  return ((data ?? []) as BookingRow[]).map((r) => ({ ...r, net: Number(r.net), pages: Number(r.pages) }));
}

// The magazine reports default to this month and the next five (booked ahead).
export function magazinePeriod(sp: Record<string, string | string[] | undefined>): Period {
  if (sp.period) return periodFrom(sp);
  const ym = ukToday().slice(0, 7);
  return { preset: "custom", from: `${ym}-01`, to: addDaysTo(`${addMonthsTo(ym, 6)}-01`, -1), label: "This month and the next five" };
}

// ─── Invoices and VAT ───────────────────────────────────────────────────────

export type InvoiceRow = {
  id: string;
  doc_type: "invoice" | "credit_note";
  number: string;
  issue_date: string;
  due_date: string | null;
  status: string;
  paid_on: string | null;
  customer_name: string | null;
  salesperson: string | null;
  net: number;
  vat: number;
  total: number;
  adverts: boolean;
};

export async function getInvoices(from: string, to: string): Promise<InvoiceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("report_invoices", { p_from: from, p_to: to });
  return ((data ?? []) as InvoiceRow[]).map((r) => ({ ...r, net: Number(r.net), vat: Number(r.vat), total: Number(r.total) }));
}

export type VatRow = { id: string; doc_type: "invoice" | "credit_note"; number: string; cash_date: string; customer_name: string | null; tax_rate: number; net: number; vat: number };

export async function getVatCash(from: string, to: string): Promise<VatRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("report_vat_cash", { p_from: from, p_to: to });
  return ((data ?? []) as VatRow[]).map((r) => ({ ...r, tax_rate: Number(r.tax_rate), net: Number(r.net), vat: Number(r.vat) }));
}

// ─── Direct Debits ──────────────────────────────────────────────────────────

export type DirectDebitRow = { id: string; name: string; general: string | null; owner: string | null };

// Customers with an active Direct Debit ("Active" or "FMN Active").
export async function getDirectDebits(): Promise<DirectDebitRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, direct_debit_status, owner_id")
    .is("erased_at", null)
    .in("direct_debit_status", ["Active", "FMN Active"])
    .order("name");
  const ownerIds = [...new Set((data ?? []).map((c) => c.owner_id).filter(Boolean))] as string[];
  const { data: people } = ownerIds.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds) : { data: [] };
  const nameOf = (id: string | null) => {
    const p = (people ?? []).find((x) => x.id === id);
    return p ? (p.full_name ?? p.email) : null;
  };
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, general: c.direct_debit_status, owner: nameOf(c.owner_id) }));
}

// ─── CSV ────────────────────────────────────────────────────────────────────
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Quote anything with commas, quotes or new lines; stop spreadsheets
    // treating text that starts with = + - @ as a formula.
    const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

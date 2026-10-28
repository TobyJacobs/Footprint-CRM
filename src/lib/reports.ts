import "server-only";
import { addDaysTo, addMonthsTo, ukToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

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
export const marginOf = (net: number, cost: number) => (net > 0 ? Math.round(((net - cost) / net) * 1000) / 10 : null);

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

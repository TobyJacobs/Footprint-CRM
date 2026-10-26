import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Figures for the Dashboards section (Revenue, Pipeline, Renewals, Time).

export type DashboardTab = "revenue" | "pipeline" | "renewals" | "time";

export const dashboardTabLabels: Record<DashboardTab, string> = {
  revenue: "Revenue",
  pipeline: "Pipeline",
  renewals: "Renewals",
  time: "Time",
};

// Which tabs a person may open. Directors and admins see everything; Finance
// sees money and renewals; Sales see revenue and pipeline (their own figures
// only — the database enforces that); anyone in Projects sees Time.
export function allowedTabs(user: CurrentUser): DashboardTab[] {
  if (!user.can("dashboards", "view")) return [];
  const director = user.isAdmin || user.dashboards.includes("director");
  const finance = user.dashboards.includes("finance");
  const sales = user.dashboards.includes("sales");
  const tabs: DashboardTab[] = [];
  if (user.can("quotes", "view") && (director || finance || sales)) tabs.push("revenue", "pipeline");
  if (director || finance) tabs.push("renewals");
  if (user.can("projects", "view")) tabs.push("time");
  return tabs;
}

// ─── Periods ────────────────────────────────────────────────────────────────

export const periodOptions = [3, 6, 12, 24] as const;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// The last N whole months up to today: e.g. 12 → from the 1st of the month
// eleven months ago until today.
export function periodRange(months: number) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return { from: iso(from), to: iso(now), months };
}

// The same dates one year earlier, for comparisons.
export function lastYear(range: { from: string; to: string }) {
  const shift = (s: string) => `${Number(s.slice(0, 4)) - 1}${s.slice(4)}`.replace(/-02-29$/, "-02-28");
  return { from: shift(range.from), to: shift(range.to) };
}

// Month keys ("2026-10") from the start of a range to its end.
export function monthKeys(from: string, to: string) {
  const keys: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endKey = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    keys.push(key);
    if (key >= endKey || keys.length > 60) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

export const monthShort = (key: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(new Date(`${key}-15T12:00:00`));

export const marginPct = (net: number, cost: number) => (net > 0 ? Math.round(((net - cost) / net) * 1000) / 10 : null);

// ─── Revenue ────────────────────────────────────────────────────────────────

type Money = { net: number; cost: number };
export type Revenue = {
  months: ({ month: string } & Money)[];
  owners: ({ owner_id: string | null; name: string; invoices: number } & Money)[];
  accounts: ({ code: string | null; name: string } & Money)[];
  customers: ({ customer_id: string; name: string } & Money)[];
};

const num = (v: unknown) => Number(v ?? 0);

export async function getRevenue(from: string, to: string, ownerId: string | null): Promise<Revenue> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_revenue", { p_from: from, p_to: to, p_owner: ownerId });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Record<string, Record<string, unknown>[]>;
  const money = (r: Record<string, unknown>) => ({ net: num(r.net), cost: num(r.cost) });
  return {
    months: (d.months ?? []).map((r) => ({ month: String(r.month), ...money(r) })),
    owners: (d.owners ?? []).map((r) => ({ owner_id: (r.owner_id as string | null) ?? null, name: String(r.name), invoices: num(r.invoices), ...money(r) })),
    accounts: (d.accounts ?? []).map((r) => ({ code: (r.code as string | null) ?? null, name: String(r.name), ...money(r) })),
    customers: (d.customers ?? []).map((r) => ({ customer_id: String(r.customer_id), name: String(r.name), ...money(r) })),
  };
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

type WonLost = { quoted_count: number; quoted: number; won_count: number; won: number; lost_count: number; lost: number };
export type Pipeline = {
  months: ({ month: string } & WonLost)[];
  owners: ({ owner_id: string | null; name: string } & WonLost)[];
  avgDaysToWin: number | null;
  reasons: { reason: string; n: number; value: number }[];
  openCount: number;
  openValue: number;
  openExpired: number;
  ages: { label: string; n: number; value: number }[];
  biggest: { id: string; number: string; title: string | null; value: number; issue_date: string; valid_until: string | null; customer: string | null; owner: string | null }[];
  // Draft opportunities (not sent yet): kept apart from every figure above.
  draftCount: number;
  draftValue: number;
  drafts: { id: string; number: string; title: string | null; value: number; issue_date: string; customer: string | null; owner: string | null }[];
};

const AGE_LABELS = ["Up to 30 days", "31–60 days", "61–90 days", "Over 90 days"];

export async function getPipeline(from: string, to: string, ownerId: string | null): Promise<Pipeline> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_pipeline", { p_from: from, p_to: to, p_owner: ownerId });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Record<string, unknown>;
  const rows = (k: string) => (d[k] as Record<string, unknown>[] | null) ?? [];
  const wl = (r: Record<string, unknown>): WonLost => ({
    quoted_count: num(r.quoted_count),
    quoted: num(r.quoted),
    won_count: num(r.won_count),
    won: num(r.won),
    lost_count: num(r.lost_count),
    lost: num(r.lost),
  });
  const ages = rows("ages");
  return {
    months: rows("months").map((r) => ({ month: String(r.month), ...wl(r) })),
    owners: rows("owners").map((r) => ({ owner_id: (r.owner_id as string | null) ?? null, name: String(r.name), ...wl(r) })),
    avgDaysToWin: d.avg_days_to_win === null || d.avg_days_to_win === undefined ? null : num(d.avg_days_to_win),
    reasons: rows("reasons").map((r) => ({ reason: String(r.reason), n: num(r.n), value: num(r.value) })),
    openCount: num(d.open_count),
    openValue: num(d.open_value),
    openExpired: num(d.open_expired),
    ages: AGE_LABELS.map((label, i) => {
      const a = ages.find((x) => num(x.bucket) === i + 1);
      return { label, n: a ? num(a.n) : 0, value: a ? num(a.value) : 0 };
    }),
    draftCount: num(d.draft_count),
    draftValue: num(d.draft_value),
    drafts: rows("drafts").map((r) => ({
      id: String(r.id),
      number: String(r.number),
      title: (r.title as string | null) ?? null,
      value: num(r.value),
      issue_date: String(r.issue_date),
      customer: (r.customer as string | null) ?? null,
      owner: (r.owner as string | null) ?? null,
    })),
    biggest: rows("biggest").map((r) => ({
      id: String(r.id),
      number: String(r.number),
      title: (r.title as string | null) ?? null,
      value: num(r.value),
      issue_date: String(r.issue_date),
      valid_until: (r.valid_until as string | null) ?? null,
      customer: (r.customer as string | null) ?? null,
      owner: (r.owner as string | null) ?? null,
    })),
  };
}

export const winRate = (won: number, lost: number) => (won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null);

import "server-only";
import { createClient } from "@/lib/supabase/server";

// Shared figures for the role dashboards (home page) and the Staff hub.

export const dashboardTypes = [
  { value: "director", label: "Directors", description: "Group goal, profit, team leaderboard, cash and pipeline." },
  { value: "sales", label: "Sales", description: "Their own sales against target, commission and open quotes." },
  { value: "finance", label: "Finance", description: "Budget, margin, money owed, payments and recurring billing." },
  { value: "operations", label: "Operations", description: "Orders to deliver, purchase orders and supplier deliveries." },
  { value: "general", label: "General", description: "Just the person's sections — no figures." },
] as const;
export type DashboardType = (typeof dashboardTypes)[number]["value"];
export const dashboardOrder: DashboardType[] = ["director", "finance", "sales", "operations", "general"];

export type OwnerStats = {
  owner_id: string | null;
  name: string;
  invoiced: number;
  cost: number;
  paid_net: number;
  paid_cost: number;
  paid_gross: number;
  quotes_sent: number;
  quotes_value: number;
  won: number;
  won_value: number;
  lost: number;
  open_quotes: number;
  open_value: number;
  credit_notes: number;
  credit_value: number;
};

export type Month = { key: string; from: string; to: string; label: string; daysInMonth: number; dayOfMonth: number | null };

// A calendar month. `key` is "2026-10"; anything invalid means this month.
export function getMonth(key?: string | null): Month {
  const now = new Date();
  const m = key && /^\d{4}-\d{2}$/.test(key) ? key : now.toISOString().slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const last = new Date(Date.UTC(y, mo, 0));
  const isCurrent = m === now.toISOString().slice(0, 7);
  return {
    key: m,
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
    label: first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    daysInMonth: last.getUTCDate(),
    dayOfMonth: isCurrent ? now.getUTCDate() : null,
  };
}

export function recentMonths(count: number): Month[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return getMonth(d.toISOString().slice(0, 7));
  });
}

export async function getTeamStats(month: Month): Promise<OwnerStats[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("team_month_stats", { p_from: month.from, p_to: month.to });
  if (error) throw new Error(`Couldn't load figures: ${error.message}`);
  return ((data ?? []) as OwnerStats[]).map((o) => {
    const out = { ...o };
    for (const k of Object.keys(out) as (keyof OwnerStats)[]) {
      if (k !== "owner_id" && k !== "name") (out[k] as number) = Number(out[k]);
    }
    return out;
  });
}

export function sumStats(rows: OwnerStats[]): OwnerStats {
  const total: OwnerStats = {
    owner_id: null, name: "Everyone", invoiced: 0, cost: 0, paid_net: 0, paid_cost: 0, paid_gross: 0,
    quotes_sent: 0, quotes_value: 0, won: 0, won_value: 0, lost: 0, open_quotes: 0, open_value: 0,
    credit_notes: 0, credit_value: 0,
  };
  for (const r of rows) {
    for (const k of Object.keys(total) as (keyof OwnerStats)[]) {
      if (k !== "owner_id" && k !== "name") (total[k] as number) += r[k] as number;
    }
  }
  return total;
}

export const grossProfit = (s: OwnerStats) => s.invoiced - s.cost;
export const marginOf = (s: OwnerStats) => (s.invoiced > 0 ? Math.round(((s.invoiced - s.cost) / s.invoiced) * 1000) / 10 : null);
export const winRate = (s: OwnerStats) => (s.won + s.lost > 0 ? Math.round((s.won / (s.won + s.lost)) * 100) : null);

// ─── Targets ────────────────────────────────────────────────────────────────

export type TargetRow = { id: string; user_id: string | null; metric: string; month: string | null; amount: number; is_example: boolean };

export async function getTargets(): Promise<TargetRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("monthly_targets").select("id, user_id, metric, month, amount, is_example");
  return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));
}

// The target for a person (or the group, userId null) in a month: one set for
// that month wins over the "every month" one.
export function targetFor(rows: TargetRow[], metric: string, userId: string | null, month: Month) {
  const mine = rows.filter((r) => r.metric === metric && r.user_id === userId);
  return mine.find((r) => r.month?.slice(0, 7) === month.key) ?? mine.find((r) => r.month === null) ?? null;
}

// ─── Commission ─────────────────────────────────────────────────────────────

export type CommissionRule = {
  id: string;
  user_id: string | null;
  basis: "gross_profit" | "invoiced";
  rate: number;
  counted_when: "invoiced" | "paid";
  is_example: boolean;
};

export async function getCommissionRules(): Promise<CommissionRule[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("commission_rules").select("id, user_id, basis, rate, counted_when, is_example");
  return (data ?? []).map((r) => ({ ...r, rate: Number(r.rate) })) as CommissionRule[];
}

export const ruleForPerson = (rules: CommissionRule[], userId: string | null) =>
  rules.find((r) => r.user_id === userId) ?? rules.find((r) => r.user_id === null) ?? null;

export function describeRule(r: CommissionRule) {
  return `${r.rate}% of ${r.basis === "gross_profit" ? "gross profit" : "sales (ex VAT)"} on invoices ${r.counted_when === "paid" ? "paid" : "raised"} in the month`;
}

// Commission earned in a month under a rule.
export function commissionFor(s: OwnerStats, rule: CommissionRule | null) {
  if (!rule) return { base: 0, amount: 0 };
  const base =
    rule.counted_when === "paid"
      ? rule.basis === "gross_profit" ? s.paid_net - s.paid_cost : s.paid_net
      : rule.basis === "gross_profit" ? s.invoiced - s.cost : s.invoiced;
  return { base, amount: Math.round(Math.max(0, base) * rule.rate) / 100 };
}

// ─── Recurring billing ──────────────────────────────────────────────────────

const perMonth: Record<string, number> = { monthly: 1, quarterly: 1 / 3, six_monthly: 1 / 6, annually: 1 / 12 };

export async function getRecurringSummary() {
  const supabase = await createClient();
  const { data } = await supabase.from("recurring_invoices").select("subtotal, frequency, next_date").eq("status", "active");
  const rows = data ?? [];
  return {
    active: rows.length,
    monthlyValue: Math.round(rows.reduce((s, r) => s + Number(r.subtotal) * (perMonth[r.frequency] ?? 1), 0) * 100) / 100,
    nextDate: rows.map((r) => r.next_date as string).sort()[0] ?? null,
  };
}

// Today's date (or a number of days from today) as "2026-10-02".
export function isoDate(daysFromToday = 0) {
  return new Date(Date.now() + daysFromToday * 86400000).toISOString().slice(0, 10);
}

import "server-only";
import { createClient } from "@/lib/supabase/server";

// Figures for the charts in Sales & Operations. The adding-up happens in the
// database (sales_stats), as the signed-in person, so row-level security
// still decides what they can see. Money is net of VAT except "owed".

export type MonthStats = {
  month: string; // 2026-10
  label: string; // Oct 26
  quoted: number;
  won: number;
  lost: number;
  invoiced: number; // invoices issued in the month, minus credit notes
  paid: number;
  unpaid: number;
  marginPct: number | null;
};

export type SalesStats = {
  months: MonthStats[];
  owed: { bucket: string; value: number }[];
  topCustomers: { name: string; value: number }[];
  totals: {
    invoiced: number;
    marginPct: number | null;
    quotesWon: number;
    quotesLost: number;
    winRate: number | null;
    openQuotes: number;
    openQuotesValue: number;
    owed: number;
    overdue: number;
  };
};

type Raw = {
  months: { month: string; quoted: number; won: number; lost: number; invoiced: number; credited: number; paid: number; unpaid: number; cost: number }[];
  quotes: { won: number; lost: number; open_count: number; open_value: number };
  top: { name: string; value: number }[];
  owed: { not_due: number; d30: number; d60: number; d90: number; over90: number } | null;
};

const round = (n: number) => Math.round(n * 100) / 100;
const pct = (profit: number, sales: number) => (sales > 0 ? Math.round((profit / sales) * 1000) / 10 : null);

export async function getSalesStats({ months = 12, ownerId }: { months?: number; ownerId?: string | null }): Promise<SalesStats> {
  const supabase = await createClient();
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (months - 1), 1));

  const { data, error } = await supabase.rpc("sales_stats", {
    p_from: start.toISOString().slice(0, 10),
    p_owner: ownerId ?? null,
  });
  if (error) throw new Error(`Couldn't load figures: ${error.message}`);
  const raw = data as Raw;
  const found = new Map(raw.months.map((m) => [m.month, m]));

  let totalInvoiced = 0;
  let totalCost = 0;
  const monthList: MonthStats[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const key = d.toISOString().slice(0, 7);
    const r = found.get(key);
    const invoiced = r ? Number(r.invoiced) - Number(r.credited) : 0;
    const cost = r ? Number(r.cost) : 0;
    totalInvoiced += invoiced;
    totalCost += cost;
    monthList.push({
      month: key,
      label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
      quoted: round(Number(r?.quoted ?? 0)),
      won: round(Number(r?.won ?? 0)),
      lost: round(Number(r?.lost ?? 0)),
      invoiced: round(invoiced),
      paid: round(Number(r?.paid ?? 0)),
      unpaid: round(Number(r?.unpaid ?? 0)),
      marginPct: pct(invoiced - cost, invoiced),
    });
  }

  const o = raw.owed ?? { not_due: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
  const owed = [
    { bucket: "Not due yet", value: round(Number(o.not_due)) },
    { bucket: "1–30 days late", value: round(Number(o.d30)) },
    { bucket: "31–60 days late", value: round(Number(o.d60)) },
    { bucket: "61–90 days late", value: round(Number(o.d90)) },
    { bucket: "Over 90 days late", value: round(Number(o.over90)) },
  ];
  const owedTotal = round(owed.reduce((s, b) => s + b.value, 0));
  const won = Number(raw.quotes.won);
  const lost = Number(raw.quotes.lost);

  return {
    months: monthList,
    owed,
    topCustomers: raw.top.map((t) => ({ name: t.name, value: round(Number(t.value)) })),
    totals: {
      invoiced: round(totalInvoiced),
      marginPct: pct(totalInvoiced - totalCost, totalInvoiced),
      quotesWon: won,
      quotesLost: lost,
      winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
      openQuotes: Number(raw.quotes.open_count),
      openQuotesValue: round(Number(raw.quotes.open_value)),
      owed: owedTotal,
      overdue: round(owedTotal - owed[0].value),
    },
  };
}

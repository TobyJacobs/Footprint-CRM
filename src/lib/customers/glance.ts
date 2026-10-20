import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ukToday } from "@/lib/dates";

// "Customer at a glance": spend, money owed and quotes for one customer, using
// the same rules as the Dashboards:
// * spend = invoices issued or paid, minus issued credit notes, before VAT;
// * owed = what's left on issued (unpaid) invoices after credit notes raised
//   against them, including VAT (what the customer actually has to pay).
// Only documents the signed-in person may see are counted (database rules).

export type Glance = {
  lifetime: number;
  thisYear: number;
  lastYear: number;
  year: number;
  invoices: number;
  firstInvoice: string | null;
  owed: number;
  overdue: number;
  overdueCount: number;
  avgDaysToPay: number | null;
  quotesWon: number;
  quotesLost: number;
  quotesOpen: number;
  winRate: number | null;
  wonValue: number;
  byService: { name: string; value: number }[];
};

type Doc = {
  id: string;
  doc_type: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  total: number;
  business_unit: string | null;
  paid_at: string | null;
  source_document_id: string | null;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function summarise(docs: Doc[], today = ukToday()): Glance {
  const year = Number(today.slice(0, 4));
  const invoices = docs.filter((d) => d.doc_type === "invoice" && (d.status === "issued" || d.status === "paid"));
  const credits = docs.filter((d) => d.doc_type === "credit_note" && d.status === "issued");
  const quotes = docs.filter((d) => d.doc_type === "quote");

  // Spend, net of credit notes (each counted in the year it was issued).
  const signed = [...invoices.map((d) => ({ d, sign: 1 })), ...credits.map((d) => ({ d, sign: -1 }))];
  const spendIn = (y: number | null) =>
    round(signed.filter(({ d }) => y === null || d.issue_date.startsWith(String(y))).reduce((t, { d, sign }) => t + sign * Number(d.subtotal), 0));

  const services = new Map<string, number>();
  for (const { d, sign } of signed) {
    const name = d.business_unit || "Not set";
    services.set(name, (services.get(name) ?? 0) + sign * Number(d.subtotal));
  }

  // Owed: unpaid invoices less any credit notes raised against them.
  const creditedAgainst = new Map<string, number>();
  for (const c of credits) if (c.source_document_id) creditedAgainst.set(c.source_document_id, (creditedAgainst.get(c.source_document_id) ?? 0) + Number(c.total));
  let owed = 0;
  let overdue = 0;
  let overdueCount = 0;
  for (const i of invoices.filter((d) => d.status === "issued")) {
    const balance = Math.max(0, Number(i.total) - (creditedAgainst.get(i.id) ?? 0));
    owed += balance;
    if (balance > 0 && i.due_date && i.due_date < today) {
      overdue += balance;
      overdueCount++;
    }
  }

  // How long they usually take to pay (issue date to the day it was marked paid).
  const payDays = invoices
    .filter((d) => d.status === "paid" && d.paid_at)
    .map((d) => (Date.parse(`${ukToday(new Date(d.paid_at!))}T00:00:00Z`) - Date.parse(`${d.issue_date}T00:00:00Z`)) / 86400000)
    .filter((n) => n >= 0);

  const won = quotes.filter((q) => q.status === "accepted" || q.status === "converted");
  const lost = quotes.filter((q) => q.status === "declined");

  return {
    lifetime: spendIn(null),
    thisYear: spendIn(year),
    lastYear: spendIn(year - 1),
    year,
    invoices: invoices.length,
    firstInvoice: invoices.map((d) => d.issue_date).sort()[0] ?? null,
    owed: round(owed),
    overdue: round(overdue),
    overdueCount,
    avgDaysToPay: payDays.length ? Math.round(payDays.reduce((t, n) => t + n, 0) / payDays.length) : null,
    quotesWon: won.length,
    quotesLost: lost.length,
    quotesOpen: quotes.filter((q) => q.status === "sent").length,
    winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
    wonValue: round(won.reduce((t, q) => t + Number(q.subtotal), 0)),
    byService: [...services.entries()]
      .map(([name, value]) => ({ name, value: round(value) }))
      .filter((s) => s.value !== 0)
      .sort((a, b) => b.value - a.value),
  };
}

export async function loadGlance(supabase: SupabaseClient, customerId: string): Promise<Glance> {
  const { data } = await supabase
    .from("sales_documents")
    .select("id, doc_type, status, issue_date, due_date, subtotal, total, business_unit, paid_at, source_document_id")
    .eq("customer_id", customerId)
    .in("doc_type", ["invoice", "credit_note", "quote"])
    .limit(5000);
  return summarise((data ?? []) as Doc[]);
}

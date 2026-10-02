import { OwedChart } from "@/components/charts/SalesCharts";
import { longDate } from "@/lib/customers/display";
import {
  getMonth, getRecurringSummary, getTargets, getTeamStats, grossProfit, isoDate, marginOf, sumStats, targetFor,
} from "@/lib/dashboards/data";
import { getSalesStats } from "@/lib/sales/stats";
import { createClient } from "@/lib/supabase/server";
import { GoalBar, SimpleList, Tile, money, pacePct } from "./parts";

// Finance team: budget, margin, cash in, money owed, recurring billing.
export default async function FinanceDashboard() {
  const month = getMonth();
  const supabase = await createClient();
  const today = isoDate();

  const [team, targets, owedStats, recurring, { data: overdue }, { count: draftInvoices }] = await Promise.all([
    getTeamStats(month),
    getTargets(),
    getSalesStats({ months: 1 }),
    getRecurringSummary(),
    supabase
      .from("sales_documents")
      .select("id, number, total, due_date, customers!sales_documents_customer_id_fkey(name)")
      .eq("doc_type", "invoice")
      .eq("status", "issued")
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(8),
    supabase.from("sales_documents").select("id", { count: "exact", head: true }).eq("doc_type", "invoice").eq("status", "draft"),
  ]);

  const all = sumStats(team);
  const budget = targetFor(targets, "invoiced", null, month);
  const marginTarget = targetFor(targets, "margin_pct", null, month);
  const margin = marginOf(all);
  const lateDays = (d: string) => Math.floor((Date.parse(today) - Date.parse(d)) / 86400000);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <GoalBar
          title={`Invoiced against budget — ${month.label}`}
          actual={all.invoiced}
          target={budget?.amount ?? null}
          pacePct={pacePct(month.dayOfMonth, month.daysInMonth)}
          example={budget?.is_example}
        />
        <GoalBar
          title="Margin against target"
          actual={margin ?? 0}
          target={marginTarget?.amount ?? null}
          format={(n) => `${n}%`}
          example={marginTarget?.is_example}
          rate
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Cash received this month" value={money(all.paid_gross)} note="Invoices marked paid, including VAT" tone="teal" />
        <Tile label="Gross profit this month" value={money(grossProfit(all))} note={`On ${money(all.invoiced)} invoiced (ex VAT)`} />
        <Tile
          label="Owed to us"
          value={money(owedStats.totals.owed)}
          note={owedStats.totals.overdue > 0 ? `${money(owedStats.totals.overdue)} overdue` : "Nothing overdue"}
          tone={owedStats.totals.overdue > 0 ? "red" : undefined}
          href="/sales/invoices?status=issued"
        />
        <Tile
          label="Credit notes this month"
          value={String(all.credit_notes)}
          note={all.credit_notes ? `${money(all.credit_value)} credited` : "None"}
          tone={all.credit_notes ? "amber" : undefined}
          href="/sales/credit-notes"
        />
        <Tile
          label="Recurring billing"
          value={`${money(recurring.monthlyValue)}/mo`}
          note={`${recurring.active} active${recurring.nextDate ? ` · next run ${longDate(recurring.nextDate)}` : ""}`}
          href="/sales/recurring"
        />
        <Tile
          label="Draft invoices"
          value={String(draftInvoices ?? 0)}
          note="Waiting to be checked and issued"
          tone={draftInvoices ? "amber" : undefined}
          href="/sales/invoices?status=draft"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-fp-border bg-white p-5">
          <h2 className="mb-3 font-bold">Money owed, by how late it is</h2>
          <OwedChart owed={owedStats.owed} height={250} />
        </section>
        <SimpleList
          title="Oldest overdue invoices"
          empty="Nothing overdue."
          action={{ href: "/sales/invoices?status=issued", label: "All unpaid" }}
          rows={(overdue ?? []).map((i) => ({
            key: i.id,
            href: `/sales/${i.id}`,
            primary: `${i.number} · ${(i.customers as unknown as { name: string } | null)?.name ?? ""}`,
            secondary: `${lateDays(i.due_date!)} days late (due ${longDate(i.due_date)})`,
            right: money(Number(i.total)),
            tone: lateDays(i.due_date!) > 60 ? "red" : "amber",
          }))}
        />
      </div>
    </div>
  );
}

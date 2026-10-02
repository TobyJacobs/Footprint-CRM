import Link from "next/link";
import { InvoicedChart, OwedChart } from "@/components/charts/SalesCharts";
import {
  commissionFor, getCommissionRules, getMonth, getRecurringSummary, getTargets, getTeamStats,
  grossProfit, marginOf, ruleForPerson, sumStats, targetFor, winRate,
} from "@/lib/dashboards/data";
import { getSalesStats } from "@/lib/sales/stats";
import { GoalBar, Tile, money, pacePct } from "./parts";

// Directors: the whole group this month — goal, profit, team, cash, pipeline.
export default async function DirectorDashboard() {
  const month = getMonth();
  const [team, targets, rules, trend, recurring] = await Promise.all([
    getTeamStats(month),
    getTargets(),
    getCommissionRules(),
    getSalesStats({ months: 12 }),
    getRecurringSummary(),
  ]);
  const all = sumStats(team);
  const goal = targetFor(targets, "invoiced", null, month);
  const gpGoal = targetFor(targets, "gross_profit", null, month);
  const marginGoal = targetFor(targets, "margin_pct", null, month);
  const margin = marginOf(all);
  const pace = pacePct(month.dayOfMonth, month.daysInMonth);
  const people = team.filter((t) => t.owner_id && (t.invoiced || t.quotes_sent || t.open_quotes));

  return (
    <div className="grid gap-6">
      <GoalBar
        title={`Group sales goal — ${month.label}`}
        actual={all.invoiced}
        target={goal?.amount ?? null}
        pacePct={pace}
        example={goal?.is_example}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Gross profit this month"
          value={money(grossProfit(all))}
          note={gpGoal ? `Target ${money(gpGoal.amount)}` : "Sales minus cost of sales"}
          tone="teal"
        />
        <Tile
          label="Margin"
          value={margin === null ? "—" : `${margin}%`}
          note={marginGoal ? `Target ${marginGoal.amount}%${marginGoal.is_example ? " (example)" : ""}` : undefined}
          tone={margin !== null && marginGoal && margin < marginGoal.amount ? "amber" : "teal"}
        />
        <Tile
          label="Open quotes (pipeline)"
          value={money(all.open_value)}
          note={`${all.open_quotes} waiting for an answer · ${winRate(all) ?? "—"}% won this month`}
          tone="pink"
          href="/sales/quotes?status=sent"
        />
        <Tile
          label="Owed to us"
          value={money(trend.totals.owed)}
          note={trend.totals.overdue > 0 ? `${money(trend.totals.overdue)} overdue` : "Nothing overdue"}
          tone={trend.totals.overdue > 0 ? "red" : undefined}
          href="/sales/overview"
        />
        <Tile label="Cash received this month" value={money(all.paid_gross)} note="Invoices paid, including VAT" />
        <Tile
          label="Recurring billing"
          value={`${money(recurring.monthlyValue)}/mo`}
          note={`${recurring.active} active (ex VAT)`}
          href="/sales/recurring"
        />
        <Tile label="Quotes sent this month" value={String(all.quotes_sent)} note={`${money(all.quotes_value)} quoted`} />
        <Tile
          label="Credit notes this month"
          value={String(all.credit_notes)}
          note={all.credit_notes ? `${money(all.credit_value)} credited` : "None"}
          tone={all.credit_notes ? "amber" : undefined}
        />
      </div>

      <section className="rounded-lg border border-fp-border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Team this month</h2>
          <Link href="/admin/targets" className="text-sm font-semibold text-fp-teal-deep hover:underline">
            Targets &amp; commission
          </Link>
        </div>
        {people.length === 0 ? (
          <p className="text-sm text-fp-dark/70">No sales activity yet this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Salesperson</th>
                  <th className="py-2 pr-3 text-right font-semibold">Invoiced</th>
                  <th className="py-2 pr-3 text-right font-semibold">Target</th>
                  <th className="py-2 pr-3 text-right font-semibold">Gross profit</th>
                  <th className="py-2 pr-3 text-right font-semibold">Margin</th>
                  <th className="py-2 pr-3 text-right font-semibold">Quotes won</th>
                  <th className="py-2 text-right font-semibold">Commission</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const t = targetFor(targets, "invoiced", p.owner_id, month);
                  const c = commissionFor(p, ruleForPerson(rules, p.owner_id));
                  return (
                    <tr key={p.owner_id} className="border-b border-fp-border last:border-0">
                      <td className="py-2 pr-3 font-semibold">{p.name}</td>
                      <td className="py-2 pr-3 text-right">{money(p.invoiced)}</td>
                      <td className="py-2 pr-3 text-right">
                        {t ? `${Math.round((p.invoiced / t.amount) * 100)}% of ${money(t.amount)}` : <span className="text-fp-mid">—</span>}
                      </td>
                      <td className="py-2 pr-3 text-right">{money(grossProfit(p))}</td>
                      <td className="py-2 pr-3 text-right">{marginOf(p) === null ? "—" : `${marginOf(p)}%`}</td>
                      <td className="py-2 pr-3 text-right">
                        {p.won} of {p.won + p.lost}
                      </td>
                      <td className="py-2 text-right">{money(c.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rules.some((r) => r.is_example) && (
          <p className="mt-3 text-xs text-fp-dark/70">Commission uses an example rule until the real one is set.</p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-fp-border bg-white p-5">
          <h2 className="mb-3 font-bold">Sales over the last 12 months</h2>
          <InvoicedChart months={trend.months} height={260} />
        </section>
        <section className="rounded-lg border border-fp-border bg-white p-5">
          <h2 className="mb-3 font-bold">Money owed by customers</h2>
          <OwedChart owed={trend.owed} height={260} />
        </section>
      </div>
    </div>
  );
}

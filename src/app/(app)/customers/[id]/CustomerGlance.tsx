import { MoneyBars } from "@/components/charts/DashboardCharts";
import { Tile, money } from "@/components/dashboards/parts";
import { Card } from "@/components/ui";
import { longDate } from "@/lib/customers/display";
import type { Glance } from "@/lib/customers/glance";

// "Customer at a glance": spend, money owed, quotes and spend by service.
export default function CustomerGlance({ g, customerName }: { g: Glance; customerName: string }) {
  const change = g.lastYear > 0 ? Math.round(((g.thisYear - g.lastYear) / g.lastYear) * 100) : null;
  // The invoice list searches by customer name; "issued" = not paid yet.
  const invoicesLink = `/sales/invoices?status=issued&q=${encodeURIComponent(customerName)}`;
  return (
    <Card title="Customer at a glance">
      {g.invoices === 0 && g.quotesWon + g.quotesLost + g.quotesOpen === 0 ? (
        <p className="text-sm text-fp-mid">No invoices or quotes yet, so there&apos;s nothing to show.</p>
      ) : (
        <div className="grid gap-5">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">Total spend (before VAT)</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Tile
                label="Lifetime"
                value={money(g.lifetime)}
                note={g.firstInvoice ? `${g.invoices} invoice${g.invoices === 1 ? "" : "s"} since ${longDate(g.firstInvoice)}` : "No invoices yet"}
                tone="pink"
              />
              <Tile
                label={`This year (${g.year})`}
                value={money(g.thisYear)}
                note={change === null ? undefined : `${change >= 0 ? "+" : ""}${change}% on last year`}
                tone={change !== null && change < 0 ? "amber" : "teal"}
              />
              <Tile label={`Last year (${g.year - 1})`} value={money(g.lastYear)} />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">Money owed (including VAT)</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Tile label="Owed now" value={money(g.owed)} note={g.owed > 0 ? "Unpaid invoices" : "Nothing owed"} href={g.owed > 0 ? invoicesLink : undefined} />
              <Tile
                label="Overdue"
                value={money(g.overdue)}
                note={g.overdueCount ? `${g.overdueCount} invoice${g.overdueCount === 1 ? "" : "s"} past the due date` : "Nothing overdue"}
                tone={g.overdue > 0 ? "red" : undefined}
                href={g.overdue > 0 ? invoicesLink : undefined}
              />
              <Tile
                label="Usually pays in"
                value={g.avgDaysToPay === null ? "—" : `${g.avgDaysToPay} day${g.avgDaysToPay === 1 ? "" : "s"}`}
                note={g.avgDaysToPay === null ? "No paid invoices yet" : "Average, from invoice date"}
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">Quotes</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Tile
                  label="Win rate"
                  value={g.winRate === null ? "—" : `${g.winRate}%`}
                  note={`${g.quotesWon} won · ${g.quotesLost} lost${g.quotesOpen ? ` · ${g.quotesOpen} waiting` : ""}`}
                  tone={g.winRate !== null && g.winRate >= 50 ? "teal" : undefined}
                />
                <Tile label="Won quotes value" value={money(g.wonValue)} note="Before VAT" />
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">Spend by service (lifetime)</h3>
              {g.byService.length ? <MoneyBars rows={g.byService} label="Spend" /> : <p className="text-sm text-fp-mid">No invoices yet.</p>}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

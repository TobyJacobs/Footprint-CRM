import type { Metadata } from "next";
import Link from "next/link";
import { Tile, money } from "@/components/dashboards/parts";
import { Card } from "@/components/ui";
import { dayLabel, getCustomers, marginOf, periodFrom, periodQuery } from "@/lib/reports";
import { Change, CsvLink, PeriodPicker, num, td, th } from "../parts";

export const metadata: Metadata = { title: "Customers" };

// Who bought in the period (top first), who's new, and who bought in the
// period before but not in this one.
export default async function CustomersReport(props: PageProps<"/reports/customers">) {
  const sp = await props.searchParams;
  const period = periodFrom(sp, "last_3");
  const { customers, lost } = await getCustomers(period.from, period.to);
  const fresh = customers.filter((c) => c.first_date && c.first_date >= period.from);
  const total = customers.reduce((s, c) => s + c.net, 0);
  const lostTotal = lost.reduce((s, c) => s + c.before_net, 0);
  const days = Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86400000) + 1;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker period={period} />
        <CsvLink href={`/reports/csv?report=customers&${periodQuery(period)}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Customers buying" value={String(customers.length)} note={`${period.label} · ${money(total)}`} />
        <Tile label="New customers" value={String(fresh.length)} note={`First ever invoice in this period · ${money(fresh.reduce((s, c) => s + c.net, 0))}`} tone="teal" />
        <Tile label="Stopped buying" value={String(lost.length)} note={`Bought in the ${days} days before, not since · ${money(lostTotal)}`} tone={lost.length ? "red" : undefined} />
        <Tile label="Top 10 share" value={total > 0 ? `${Math.round((customers.slice(0, 10).reduce((s, c) => s + c.net, 0) / total) * 100)}%` : "—"} note="Of sales from the top 10 customers" />
      </div>

      <Card title="Top customers">
        {customers.length === 0 ? (
          <p className="text-sm text-fp-mid">No sales in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-fp-border">
                <tr>
                  <th className={th}>Customer</th>
                  <th className={`${th} text-right`}>Sales</th>
                  <th className={`${th} text-right`}>Margin</th>
                  <th className={`${th} text-right`}>Invoices</th>
                  <th className={`${th} text-right`}>Period before</th>
                  <th className={`${th} text-right`}>Change</th>
                  <th className={th}>Last invoice</th>
                  <th className={th}>Buys</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {customers.slice(0, 100).map((c) => {
                  const m = marginOf(c.net, c.cost);
                  const isNew = !!c.first_date && c.first_date >= period.from;
                  return (
                    <tr key={c.id}>
                      <td className={`${td} font-semibold`}>
                        <Link href={`/customers/${c.id}`} className="text-fp-teal-deep hover:underline">
                          {c.name}
                        </Link>
                        {isNew && <span className="ml-2 rounded bg-fp-teal/15 px-1.5 text-[11px] font-bold text-fp-teal-deep">New</span>}
                      </td>
                      <td className={num}>{money(c.net)}</td>
                      <td className={num}>{m === null ? "—" : `${m}%`}</td>
                      <td className={num}>{c.invoices}</td>
                      <td className={`${num} text-fp-dark/70`}>{c.before_net ? money(c.before_net) : "—"}</td>
                      <td className={num}>
                        <Change now={c.net} before={c.before_net} />
                      </td>
                      <td className={td}>{dayLabel(c.last_date)}</td>
                      <td className={`${td} text-xs text-fp-dark/75`}>{(c.buys ?? []).join(", ") || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {customers.length > 100 && <p className="mt-2 text-xs text-fp-mid">Showing the top 100 of {customers.length}; the CSV has them all.</p>}
          </div>
        )}
      </Card>

      <Card title={`Stopped buying (${lost.length})`}>
        {lost.length === 0 ? (
          <p className="text-sm text-fp-mid">Everyone who bought in the period before has bought again.</p>
        ) : (
          <ul className="divide-y divide-fp-border text-sm">
            {lost.slice(0, 50).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/customers/${c.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                  {c.name}
                </Link>
                <span className="text-fp-dark/75">
                  {money(c.before_net)} in the period before · last invoice {dayLabel(c.last_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-xs text-fp-mid">
        &ldquo;Period before&rdquo; is the same number of days just before this period. Buys = the customer&apos;s top sales accounts in this period. Before VAT,
        after credit notes.
      </p>
    </div>
  );
}

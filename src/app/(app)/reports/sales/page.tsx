import type { Metadata } from "next";
import Link from "next/link";
import { Tile, money } from "@/components/dashboards/parts";
import { Card } from "@/components/ui";
import { getSales, marginOf, periodFrom, periodQuery, salesGroups, yearBefore, type SalesGroup } from "@/lib/reports";
import { Change, CsvLink, PeriodPicker, num, td, th } from "../parts";

export const metadata: Metadata = { title: "Sales and profit" };

// Sales and gross profit for a period, grouped as chosen, against the same
// period last year.
export default async function SalesReport(props: PageProps<"/reports/sales">) {
  const sp = await props.searchParams;
  const period = periodFrom(sp);
  const group: SalesGroup = salesGroups.find((g) => g.key === sp.group)?.key ?? "month";
  const prev = yearBefore(period);
  const [now, before] = await Promise.all([getSales(period.from, period.to, group), getSales(prev.from, prev.to, group)]);

  // Months line up with the same month last year; everything else by name.
  const keyFor = (k: string) => (group === "month" ? `${Number(k.slice(0, 4)) + 1}${k.slice(4)}` : k);
  const beforeBy = new Map(before.map((r) => [keyFor(r.key), r]));
  const rows = [...now].sort((a, b) => (group === "month" ? a.key.localeCompare(b.key) : b.net - a.net));
  const total = now.reduce((s, r) => ({ net: s.net + r.net, cost: s.cost + r.cost, docs: s.docs + r.docs }), { net: 0, cost: 0, docs: 0 });
  const totalBefore = before.reduce((s, r) => s + r.net, 0);
  const margin = marginOf(total.net, total.cost);
  const q = periodQuery(period);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker period={period} keep={{ group }} />
        <CsvLink href={`/reports/csv?report=sales&group=${group}&${q}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Sales" value={money(total.net)} note={`${period.label} · ${total.docs} invoice${total.docs === 1 ? "" : "s"}`} />
        <Tile
          label="Against last year"
          value={totalBefore ? `${total.net >= totalBefore ? "+" : ""}${Math.round(((total.net - totalBefore) / Math.abs(totalBefore)) * 100)}%` : "—"}
          note={`Same period last year: ${money(totalBefore)}`}
          tone={!totalBefore ? undefined : total.net >= totalBefore ? "teal" : "red"}
        />
        <Tile label="Gross profit" value={money(total.net - total.cost)} note={margin === null ? "No margin yet" : `${margin}% margin`} tone="teal" />
        <Tile label="Average invoice" value={total.docs ? money(total.net / total.docs) : "—"} note="Before VAT, after credit notes" />
      </div>

      <nav aria-label="Group by" className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-fp-mid">By</span>
        {salesGroups.map((g) => (
          <Link
            key={g.key}
            href={`/reports/sales?group=${g.key}&${q}`}
            aria-current={g.key === group ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              g.key === group ? "border-fp-black bg-fp-black text-white" : "border-fp-border bg-white hover:border-fp-pink"
            }`}
          >
            {g.label}
          </Link>
        ))}
      </nav>

      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-fp-mid">No sales in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-fp-border">
                <tr>
                  <th className={th}>{salesGroups.find((g) => g.key === group)?.label}</th>
                  <th className={`${th} text-right`}>Sales</th>
                  <th className={`${th} text-right`}>Gross profit</th>
                  <th className={`${th} text-right`}>Margin</th>
                  {group !== "account" && <th className={`${th} text-right`}>Invoices</th>}
                  <th className={`${th} text-right`}>Last year</th>
                  <th className={`${th} text-right`}>Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {rows.map((r) => {
                  const b = beforeBy.get(r.key);
                  const m = marginOf(r.net, r.cost);
                  return (
                    <tr key={r.key}>
                      <td className={`${td} font-semibold`}>
                        {group === "customer" && r.key !== "none" ? (
                          <Link href={`/customers/${r.key}`} className="text-fp-teal-deep hover:underline">
                            {r.label}
                          </Link>
                        ) : (
                          r.label
                        )}
                      </td>
                      <td className={num}>{money(r.net)}</td>
                      <td className={num}>{money(r.net - r.cost)}</td>
                      <td className={num}>{m === null ? "—" : `${m}%`}</td>
                      {group !== "account" && <td className={num}>{r.docs}</td>}
                      <td className={`${num} text-fp-dark/70`}>{b ? money(b.net) : "—"}</td>
                      <td className={num}>
                        <Change now={r.net} before={b?.net ?? 0} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-fp-black font-bold">
                <tr>
                  <td className={td}>Total</td>
                  <td className={num}>{money(total.net)}</td>
                  <td className={num}>{money(total.net - total.cost)}</td>
                  <td className={num}>{margin === null ? "—" : `${margin}%`}</td>
                  {group !== "account" && <td className={num}>{total.docs}</td>}
                  <td className={num}>{money(totalBefore)}</td>
                  <td className={num}>
                    <Change now={total.net} before={totalBefore} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-fp-mid">
        Invoices issued or paid, before VAT, less credit notes (on the date each credit note was issued). By sales account uses each line&apos;s account, so
        invoice counts aren&apos;t shown there.
      </p>
    </div>
  );
}

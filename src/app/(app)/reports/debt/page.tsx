import type { Metadata } from "next";
import Link from "next/link";
import { Tile, moneyExact } from "@/components/dashboards/parts";
import { Card } from "@/components/ui";
import { dayLabel, debtBands, getDebt, type DebtRow } from "@/lib/reports";
import { CsvLink, num, td, th } from "../parts";

export const metadata: Metadata = { title: "Money owed" };

// Aged debt: every issued, unpaid invoice by how overdue it is, by customer.
export default async function DebtReport(props: PageProps<"/reports/debt">) {
  const sp = await props.searchParams;
  const rows = await getDebt();
  const view = sp.view === "invoices" ? "invoices" : "customers";
  const sum = (list: DebtRow[]) => list.reduce((s, r) => s + r.owed, 0);
  const total = sum(rows);
  const overdue = sum(rows.filter((r) => r.band !== "current"));

  const byCustomer = [...new Map(rows.map((r) => [r.customer_id ?? "none", r])).keys()]
    .map((id) => {
      const list = rows.filter((r) => (r.customer_id ?? "none") === id);
      return {
        id,
        name: list[0].customer_name ?? "Unknown customer",
        owner: list[0].owner_name,
        bands: Object.fromEntries(debtBands.map((b) => [b.key, sum(list.filter((r) => r.band === b.key))])) as Record<string, number>,
        total: sum(list),
        oldest: Math.max(...list.map((r) => r.daysOver)),
      };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Show" className="flex gap-1.5 text-sm">
          {[
            ["customers", "By customer"],
            ["invoices", "Every invoice"],
          ].map(([k, l]) => (
            <Link
              key={k}
              href={`/reports/debt?view=${k}`}
              aria-current={k === view ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${k === view ? "border-fp-black bg-fp-black text-white" : "border-fp-border bg-white hover:border-fp-pink"}`}
            >
              {l}
            </Link>
          ))}
        </nav>
        <CsvLink href="/reports/csv?report=debt" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Tile label="Owed in total" value={moneyExact(total)} note={`${rows.length} invoice${rows.length === 1 ? "" : "s"} · inc. VAT`} />
        {debtBands.map((b) => {
          const v = sum(rows.filter((r) => r.band === b.key));
          return (
            <Tile
              key={b.key}
              label={b.label}
              value={moneyExact(v)}
              tone={b.key === "current" ? undefined : v > 0 ? (b.key === "d30" ? "amber" : "red") : undefined}
              note={b.key === "current" ? "Not overdue" : "Overdue"}
            />
          );
        })}
      </div>

      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-fp-mid">Nothing owed: every issued invoice is paid.</p>
        ) : view === "customers" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-fp-border">
                <tr>
                  <th className={th}>Customer</th>
                  <th className={th}>Salesperson</th>
                  {debtBands.map((b) => (
                    <th key={b.key} className={`${th} text-right`}>
                      {b.label}
                    </th>
                  ))}
                  <th className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {byCustomer.map((c) => (
                  <tr key={c.id}>
                    <td className={`${td} font-semibold`}>
                      {c.id !== "none" ? (
                        <Link href={`/customers/${c.id}`} className="text-fp-teal-deep hover:underline">
                          {c.name}
                        </Link>
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className={td}>{c.owner ?? "—"}</td>
                    {debtBands.map((b) => (
                      <td key={b.key} className={`${num} ${c.bands[b.key] && b.key !== "current" ? "font-semibold text-fp-error" : ""}`}>
                        {c.bands[b.key] ? moneyExact(c.bands[b.key]) : "—"}
                      </td>
                    ))}
                    <td className={`${num} font-bold`}>{moneyExact(c.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-fp-black font-bold">
                <tr>
                  <td className={td} colSpan={2}>
                    Total ({byCustomer.length} customer{byCustomer.length === 1 ? "" : "s"})
                  </td>
                  {debtBands.map((b) => (
                    <td key={b.key} className={num}>
                      {moneyExact(sum(rows.filter((r) => r.band === b.key)))}
                    </td>
                  ))}
                  <td className={num}>{moneyExact(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-fp-border">
                <tr>
                  <th className={th}>Invoice</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Issued</th>
                  <th className={th}>Due</th>
                  <th className={`${th} text-right`}>Days overdue</th>
                  <th className={`${th} text-right`}>Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {[...rows]
                  .sort((a, b) => b.daysOver - a.daysOver)
                  .map((r) => (
                    <tr key={r.id}>
                      <td className={td}>
                        <Link href={`/sales/${r.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                          {r.number}
                        </Link>
                      </td>
                      <td className={td}>{r.customer_name ?? "—"}</td>
                      <td className={td}>{dayLabel(r.issue_date)}</td>
                      <td className={td}>{r.due_date ? dayLabel(r.due_date) : "—"}</td>
                      <td className={`${num} ${r.daysOver ? "font-semibold text-fp-error" : ""}`}>{r.daysOver || "—"}</td>
                      <td className={`${num} font-semibold`}>{moneyExact(r.owed)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-fp-mid">
        Issued invoices not yet marked paid, including VAT, less any issued credit notes. Overdue counts from each invoice&apos;s due date. Part payments
        aren&apos;t recorded in FootprintOS yet, so an invoice counts in full until it&apos;s marked paid. {overdue > 0 && `Overdue in total: ${moneyExact(overdue)}.`}
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Tile, money } from "@/components/dashboards/parts";
import { Card } from "@/components/ui";
import { dayLabel, getVatCash, periodFrom, periodQuery } from "@/lib/reports";
import { CsvLink, PeriodPicker, num, td, th } from "../parts";

export const metadata: Metadata = { title: "VAT (cash accounting)" };

// VAT on a cash basis (Mag Manager's VAT cash accounting report): invoices
// count when they're marked paid, credit notes when they're issued.
export default async function VatCashReport(props: PageProps<"/reports/vat">) {
  const sp = await props.searchParams;
  const period = periodFrom(sp, "last_3");
  const rows = await getVatCash(period.from, period.to);
  const rates = [...new Set(rows.map((r) => r.tax_rate))].sort((a, b) => b - a);
  const byRate = rates.map((rate) => {
    const list = rows.filter((r) => r.tax_rate === rate);
    return { rate, net: list.reduce((s, r) => s + r.net, 0), vat: list.reduce((s, r) => s + r.vat, 0) };
  });
  const net = rows.reduce((s, r) => s + r.net, 0);
  const vat = rows.reduce((s, r) => s + r.vat, 0);
  const docs = [...new Map(rows.map((r) => [r.id, r])).values()];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker period={period} />
        <CsvLink href={`/reports/csv?report=vat&${periodQuery(period)}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="VAT received" value={money(vat)} note={`${period.label} · cash basis`} tone="pink" />
        <Tile label="Sales received" value={money(net)} note="Before VAT, less credit notes" />
        <Tile label="Documents" value={String(docs.length)} note="Paid invoices and credit notes" />
      </div>
      <Card title="By VAT rate">
        {byRate.length === 0 ? (
          <p className="text-sm text-fp-mid">Nothing paid in this period.</p>
        ) : (
          <table className="w-full max-w-xl text-left text-sm">
            <thead className="border-b border-fp-border">
              <tr>
                <th className={th}>Rate</th>
                <th className={`${th} text-right`}>Net</th>
                <th className={`${th} text-right`}>VAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fp-border">
              {byRate.map((r) => (
                <tr key={r.rate}>
                  <td className={`${td} font-semibold`}>{r.rate}%</td>
                  <td className={num}>{money(r.net)}</td>
                  <td className={num}>{money(r.vat)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className={td}>Total</td>
                <td className={num}>{money(net)}</td>
                <td className={num}>{money(vat)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>
      {rows.length > 0 && (
        <Card title="Every paid invoice and credit note">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-fp-border">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Number</th>
                  <th className={th}>Customer</th>
                  <th className={`${th} text-right`}>Rate</th>
                  <th className={`${th} text-right`}>Net</th>
                  <th className={`${th} text-right`}>VAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {rows.map((r) => (
                  <tr key={`${r.id}-${r.tax_rate}`}>
                    <td className={td}>{dayLabel(r.cash_date)}</td>
                    <td className={td}>
                      <Link href={`/sales/${r.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                        {r.number}
                      </Link>
                      {r.doc_type === "credit_note" && <span className="ml-1 text-xs text-fp-mid">credit note</span>}
                    </td>
                    <td className={td}>{r.customer_name ?? "—"}</td>
                    <td className={num}>{r.tax_rate}%</td>
                    <td className={num}>{money(r.net)}</td>
                    <td className={num}>{money(r.vat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs text-fp-mid">
        Cash basis: an invoice counts on the day it&apos;s marked paid, a credit note on the day it&apos;s issued. Part payments aren&apos;t recorded in FootprintOS
        yet, so an invoice counts in full once it&apos;s paid. Check against Xero before filing a VAT return.
      </p>
    </div>
  );
}

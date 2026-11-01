import type { Metadata } from "next";
import Link from "next/link";
import { Tile, money } from "@/components/dashboards/parts";
import { Badge, Card, secondaryButton } from "@/components/ui";
import { dayLabel, getInvoices, periodFrom, periodQuery } from "@/lib/reports";
import { CsvLink, PeriodPicker, num, td, th } from "../parts";

export const metadata: Metadata = { title: "Invoices" };

// Every invoice and credit note issued in the period (Mag Manager's invoice
// report), optionally only those with Forget Me Not adverts on them.
export default async function InvoiceReport(props: PageProps<"/reports/invoices">) {
  const sp = await props.searchParams;
  const period = periodFrom(sp, "last_month");
  const advertsOnly = sp.adverts === "1";
  const rows = (await getInvoices(period.from, period.to)).filter((r) => !advertsOnly || r.adverts);
  const sign = (r: { doc_type: string }) => (r.doc_type === "credit_note" ? -1 : 1);
  const net = rows.reduce((s, r) => s + sign(r) * r.net, 0);
  const vat = rows.reduce((s, r) => s + sign(r) * r.vat, 0);
  const unpaid = rows.filter((r) => r.doc_type === "invoice" && r.status === "issued");
  const keep = advertsOnly ? { adverts: "1" } : undefined;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker period={period} keep={keep} />
        <div className="flex flex-wrap gap-2">
          <Link href={`/reports/invoices?${periodQuery(period)}${advertsOnly ? "" : "&adverts=1"}`} className={secondaryButton}>
            {advertsOnly ? "Show all invoices" : "Magazine adverts only"}
          </Link>
          <CsvLink href={`/reports/csv?report=invoices&${periodQuery(period)}${advertsOnly ? "&adverts=1" : ""}`} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Invoiced" value={money(net)} note={`${period.label} · before VAT, less credit notes`} />
        <Tile label="VAT" value={money(vat)} note="On these documents" />
        <Tile label="Invoices" value={String(rows.filter((r) => r.doc_type === "invoice").length)} note={`${rows.filter((r) => r.doc_type === "credit_note").length} credit notes`} />
        <Tile label="Still unpaid" value={String(unpaid.length)} note={money(unpaid.reduce((s, r) => s + r.total, 0))} tone={unpaid.length ? "pink" : "teal"} />
      </div>
      <Card title={advertsOnly ? "Invoices with magazine adverts" : "All invoices and credit notes"}>
        {rows.length === 0 ? (
          <p className="text-sm text-fp-mid">None issued in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-fp-border">
                <tr>
                  <th className={th}>Number</th>
                  <th className={th}>Issued</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Salesperson</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Net</th>
                  <th className={`${th} text-right`}>VAT</th>
                  <th className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={td}>
                      <Link href={`/sales/${r.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                        {r.number}
                      </Link>
                      {r.doc_type === "credit_note" && <span className="ml-1 text-xs text-fp-mid">credit note</span>}
                    </td>
                    <td className={td}>{dayLabel(r.issue_date)}</td>
                    <td className={td}>{r.customer_name ?? "—"}</td>
                    <td className={td}>{r.salesperson ?? "—"}</td>
                    <td className={td}>
                      {r.status === "paid" ? (
                        <Badge tone="teal">Paid{r.paid_on ? ` ${dayLabel(r.paid_on)}` : ""}</Badge>
                      ) : r.doc_type === "invoice" ? (
                        <Badge tone="amber">Unpaid</Badge>
                      ) : (
                        <Badge>Issued</Badge>
                      )}
                    </td>
                    <td className={num}>{money(sign(r) * r.net)}</td>
                    <td className={num}>{money(sign(r) * r.vat)}</td>
                    <td className={num}>{money(sign(r) * r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-fp-mid">Issued and paid invoices and issued credit notes by issue date. Drafts and voided documents are left out.</p>
    </div>
  );
}

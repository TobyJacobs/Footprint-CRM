import type { Metadata } from "next";
import Link from "next/link";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, Notice, primaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { gbp, longDate } from "@/lib/customers/display";
import { addMonthsTo, ukMonth } from "@/lib/dates";
import { designStageLabel, designStageTone } from "@/lib/design/options";
import { monthLabel } from "@/lib/magazines";
import { createClient } from "@/lib/supabase/server";
import { invoiceMagazineMonth } from "./actions";
import MagazineTabs from "./MagazineTabs";

export const metadata: Metadata = { title: "Magazines" };

type SummaryRow = {
  edition_id: string;
  code: string;
  name: string;
  issue_id: string | null;
  pages: number | null;
  sales_target: number | null;
  complete: boolean | null;
  booked_pages: number;
  booked_net: number;
  booked_count: number;
  provisional_net: number;
  provisional_count: number;
};

type BookingRow = {
  line_id: string;
  document_id: string;
  doc_type: "sales_order" | "quote";
  number: string;
  status: string;
  customer_id: string | null;
  customer_name: string | null;
  edition_code: string;
  edition_name: string;
  size_name: string | null;
  line_net: number;
  owner_name: string | null;
  issue_date: string;
  artwork_job_id: string | null;
  artwork_stage: string | null;
  artwork_source: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
};

const pct = (n: number, of: number | null) => (of ? `${Math.round((n / of) * 100)}%` : "—");
const pagesLabel = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

// Forget Me Not at a glance for one month: per edition, pages booked against
// pages available, money booked against target, and what's still at quote.
export default async function MagazinesPage(props: PageProps<"/magazines">) {
  const user = await getCurrentUser();
  if (!user.can("magazines", "view")) return <NoAccess title="Magazines" />;
  const sp = await props.searchParams;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : addMonthsTo(ukMonth(), 1);
  const supabase = await createClient();
  const [{ data: summary }, { data: bookings }] = await Promise.all([
    supabase.rpc("magazine_month_summary", { p_month: `${month}-01` }),
    supabase.rpc("magazine_month_bookings", { p_month: `${month}-01` }),
  ]);
  const rows = ((summary ?? []) as SummaryRow[]).map((r) => ({
    ...r,
    booked_pages: Number(r.booked_pages),
    booked_net: Number(r.booked_net),
    provisional_net: Number(r.provisional_net),
    sales_target: r.sales_target === null ? null : Number(r.sales_target),
  }));
  const list = ((bookings ?? []) as BookingRow[]).map((b) => ({ ...b, line_net: Number(b.line_net) }));
  const booked = list.filter((b) => b.doc_type === "sales_order");
  const quoted = list.filter((b) => b.doc_type === "quote");
  const total = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const totalTarget = total((r) => r.sales_target ?? 0);
  const totalBooked = total((r) => r.booked_net);
  const totalPages = total((r) => r.pages ?? 0);
  const totalBookedPages = total((r) => r.booked_pages);
  const toInvoice = new Set(booked.filter((b) => !b.invoice_id && ["open", "completed"].includes(b.status)).map((b) => b.document_id));
  const canInvoice = user.can("quotes", "edit");

  return (
    <>
      <PageHeader title="Magazines" intro="Forget Me Not: what's booked in each edition, against its pages and sales target." />
      <MagazineTabs current="dashboard" canEdit={user.can("magazines", "edit")} />
      <div className="grid gap-6 px-6 py-8 lg:px-10">
        <Notice searchParams={sp} />
        {typeof sp.invoiced === "string" && (
          <p role="status" className="rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
            {sp.invoiced === "1" ? "1 draft invoice created." : `${sp.invoiced} draft invoices created.`} Check and send them from Sales → Invoices.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/magazines?month=${addMonthsTo(month, -1)}`} className="rounded-md border border-fp-border bg-white px-3 py-1.5 text-sm font-semibold hover:bg-fp-light">
            ← {monthLabel(addMonthsTo(month, -1))}
          </Link>
          <h2 className="text-xl font-black">{monthLabel(month)}</h2>
          <Link href={`/magazines?month=${addMonthsTo(month, 1)}`} className="rounded-md border border-fp-border bg-white px-3 py-1.5 text-sm font-semibold hover:bg-fp-light">
            {monthLabel(addMonthsTo(month, 1))} →
          </Link>
          {canInvoice && toInvoice.size > 0 && (
            <form action={invoiceMagazineMonth.bind(null, month)} className="ml-auto">
              <button type="submit" className={primaryButton}>
                Create invoices for {monthLabel(month)} ({toInvoice.size} order{toInvoice.size === 1 ? "" : "s"})
              </button>
            </form>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Booked", value: gbp(totalBooked), note: `${booked.length} advert${booked.length === 1 ? "" : "s"}` },
            { label: "Target", value: gbp(totalTarget), note: `${pct(totalBooked, totalTarget)} reached` },
            { label: "Pages booked", value: `${pagesLabel(Math.round(totalBookedPages * 100) / 100)} of ${totalPages}`, note: `${pct(totalBookedPages, totalPages)} of all pages` },
            { label: "At quote", value: gbp(total((r) => r.provisional_net)), note: `${quoted.length} advert${quoted.length === 1 ? "" : "s"} not yet ordered` },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-fp-border bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-fp-mid">{k.label}</p>
              <p className="mt-1 text-2xl font-black">{k.value}</p>
              <p className="text-xs text-fp-mid">{k.note}</p>
            </div>
          ))}
        </div>

        <Card title="Editions">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                <tr>
                  <th className="py-2 pr-3">Edition</th>
                  <th className="py-2 pr-3 text-right">Pages</th>
                  <th className="py-2 pr-3 text-right">Adverts (pages)</th>
                  <th className="py-2 pr-3 text-right">Booked</th>
                  <th className="py-2 pr-3 text-right">Target</th>
                  <th className="py-2 pr-3">Against target</th>
                  <th className="py-2 pr-3 text-right">Per page</th>
                  <th className="py-2 text-right">At quote</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {rows.map((r) => {
                  const reached = r.sales_target ? r.booked_net / r.sales_target : 0;
                  return (
                    <tr key={r.edition_id}>
                      <td className="py-2 pr-3 font-semibold">
                        {r.code}. {r.name}
                        {r.complete && (
                          <span className="ml-2">
                            <Badge tone="grey">Complete</Badge>
                          </span>
                        )}
                        {!r.issue_id && <span className="ml-2 text-xs font-normal text-fp-error">No issue set up</span>}
                      </td>
                      <td className="py-2 pr-3 text-right">{r.pages ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">
                        {pagesLabel(Math.round(r.booked_pages * 100) / 100)} <span className="text-xs text-fp-mid">({pct(r.booked_pages, r.pages)})</span>
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold">{gbp(r.booked_net)}</td>
                      <td className="py-2 pr-3 text-right">{gbp(r.sales_target) ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-fp-light" aria-hidden>
                            <div
                              className={`h-2 rounded-full ${reached >= 1 ? "bg-fp-teal-deep" : "bg-fp-pink"}`}
                              style={{ width: `${Math.min(100, reached * 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs ${reached >= 1 ? "text-fp-teal-deep" : "text-fp-dark/75"}`}>{pct(r.booked_net, r.sales_target)}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right">{r.pages ? gbp(r.booked_net / r.pages) : "—"}</td>
                      <td className="py-2 text-right text-fp-dark/75">{r.provisional_net ? gbp(r.provisional_net) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-fp-mid">
            Booked = adverts on sales orders (not cancelled). At quote = adverts on sent quotes not yet ordered. Amounts are before VAT.
          </p>
        </Card>

        <Card title={`Adverts for ${monthLabel(month)}`}>
          {list.length === 0 ? (
            <p className="text-sm text-fp-mid">
              No adverts yet. Book one with a <strong>New advertising quote</strong> (from Sales or a customer&apos;s page); once it becomes a sales order it counts
              here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                  <tr>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Edition</th>
                    <th className="py-2 pr-3">Size</th>
                    <th className="py-2 pr-3 text-right">Price</th>
                    <th className="py-2 pr-3">Order / quote</th>
                    <th className="py-2 pr-3">Artwork</th>
                    <th className="py-2 pr-3">Invoice</th>
                    <th className="py-2">Salesperson</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fp-border">
                  {list.map((b) => (
                    <tr key={b.line_id} className={b.doc_type === "quote" ? "text-fp-dark/70" : ""}>
                      <td className="py-2 pr-3">
                        {b.customer_id ? (
                          <Link href={`/customers/${b.customer_id}`} className="font-semibold text-fp-teal-deep hover:underline">
                            {b.customer_name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {b.edition_code}. {b.edition_name}
                      </td>
                      <td className="py-2 pr-3">{b.size_name ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">{gbp(b.line_net)}</td>
                      <td className="py-2 pr-3">
                        <Link href={`/sales/${b.document_id}`} className="text-fp-teal-deep hover:underline">
                          {b.number}
                        </Link>{" "}
                        {b.doc_type === "quote" && <Badge tone="amber">Quote</Badge>}
                        <span className="ml-1 text-xs text-fp-mid">{longDate(b.issue_date)}</span>
                      </td>
                      <td className="py-2 pr-3">
                        {b.doc_type === "quote" ? (
                          "—"
                        ) : b.artwork_job_id && b.artwork_stage ? (
                          <Link href={`/design/${b.artwork_job_id}`} className="hover:underline">
                            <Badge tone={designStageTone(b.artwork_stage)}>{designStageLabel(b.artwork_stage)}</Badge>
                          </Link>
                        ) : (
                          <Link href={`/sales/${b.document_id}`} className="hover:underline">
                            <Badge tone="pink">Needed</Badge>
                          </Link>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {b.invoice_id ? (
                          <Link href={`/sales/${b.invoice_id}`} className="text-fp-teal-deep hover:underline">
                            {b.invoice_number}
                          </Link>
                        ) : b.doc_type === "quote" ? (
                          "—"
                        ) : (
                          <span className="text-xs text-fp-mid">Not yet</span>
                        )}
                      </td>
                      <td className="py-2">{b.owner_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

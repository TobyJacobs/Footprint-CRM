import Image from "next/image";
import { address, gbp, longDate } from "@/lib/customers/display";
import { billingLabel, paymentNextSteps, paymentSchedule, proposalTotals, scheduleTitle } from "@/lib/sales/proposal";

export type PrintableLine = {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  line_net: number;
  billing?: string | null;
};

export type PrintableData = {
  label: string;
  forLabel?: string;
  number: string;
  title?: string | null;
  issue_date: string;
  valid_until?: string | null;
  due_date?: string | null;
  needed_by?: string | null;
  deliver_to?: string | null;
  delivery_notes?: string | null;
  warehouse?: string | null;
  reason?: string | null;
  customer_reference?: string | null;
  customer: { name: string; address?: string | null; contact?: string | null };
  lines: PrintableLine[];
  subtotal: number;
  vat_total: number;
  total: number;
  notes?: string | null;
  terms?: string | null;
  bank_details?: string | null;
  // Proposals: laid out like Footprint's quote builder (lib/sales/proposal).
  proposal?: { planMonths: number | null; depositPercent: number; preparedBy?: string | null } | null;
  company: {
    company_name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    vat_number?: string | null;
    company_number?: string | null;
  } | null;
};

// A clean, print-friendly A4 layout for quotes, sales orders and invoices.
export default function PrintableDocument({ d }: { d: PrintableData }) {
  const c = d.company ?? {};
  return (
    <article className="mx-auto max-w-[210mm] bg-white p-8 text-sm text-fp-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-4 border-fp-black pb-6">
        <Image src="/brand/footprint-logo-dark.png" alt={c.company_name ?? "Footprint Group"} width={200} height={59} priority />
        <div className="text-right text-xs leading-relaxed text-fp-dark/80">
          {c.company_name && <p className="font-bold text-fp-black">{c.company_name}</p>}
          {c.address && <p className="whitespace-pre-line">{c.address}</p>}
          {[c.phone, c.email, c.website].filter(Boolean).map((x) => (
            <p key={x as string}>{x}</p>
          ))}
        </div>
      </header>
      <div className="bg-fp-gradient h-1" />

      <section className="mt-8 flex flex-wrap justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-fp-mid">{d.forLabel ?? `${d.label} for`}</p>
          <p className="mt-1 text-base font-bold">{d.customer.name}</p>
          {d.customer.contact && <p>FAO {d.customer.contact}</p>}
          {d.customer.address && <p className="whitespace-pre-line text-fp-dark/80">{d.customer.address}</p>}
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-right">
          <dt className="text-fp-mid">{d.label}</dt>
          <dd className="font-bold">{d.number}</dd>
          <dt className="text-fp-mid">Date</dt>
          <dd>{longDate(d.issue_date)}</dd>
          {d.valid_until && (
            <>
              <dt className="text-fp-mid">Valid until</dt>
              <dd>{longDate(d.valid_until)}</dd>
            </>
          )}
          {d.due_date && (
            <>
              <dt className="text-fp-mid">Payment due</dt>
              <dd className="font-semibold">{longDate(d.due_date)}</dd>
            </>
          )}
          {d.needed_by && (
            <>
              <dt className="text-fp-mid">Needed by</dt>
              <dd className="font-semibold">{longDate(d.needed_by)}</dd>
            </>
          )}
          {d.customer_reference && (
            <>
              <dt className="text-fp-mid">{d.forLabel === "Supplier" ? "Our account" : "Your reference"}</dt>
              <dd>{d.customer_reference}</dd>
            </>
          )}
        </dl>
      </section>

      {(d.deliver_to || d.warehouse || d.reason) && (
        <section className="mt-6 grid gap-1 rounded-md bg-fp-offwhite p-3 print:bg-white">
          {d.deliver_to && (
            <p className="whitespace-pre-line">
              <span className="font-semibold">Deliver to: </span>
              {d.deliver_to}
            </p>
          )}
          {d.warehouse && (
            <p>
              <span className="font-semibold">Warehouse: </span>
              {d.warehouse}
            </p>
          )}
          {d.delivery_notes && (
            <p className="whitespace-pre-line">
              <span className="font-semibold">Delivery notes: </span>
              {d.delivery_notes}
            </p>
          )}
          {d.reason && (
            <p>
              <span className="font-semibold">Reason for credit: </span>
              {d.reason}
            </p>
          )}
        </section>
      )}

      {d.title && <h1 className="mt-8 text-lg font-black">{d.title}</h1>}

      {d.proposal ? (
        <ProposalBody d={d} />
      ) : (
        <>
      <table className="mt-6 w-full text-left">
        <thead className="border-b-2 border-fp-black text-xs uppercase tracking-wide">
          <tr>
            <th className="py-2 pr-3">Description</th>
            <th className="py-2 pr-3 text-right">Qty</th>
            <th className="py-2 pr-3 text-right">Price</th>
            <th className="py-2 pr-3 text-right">VAT</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {d.lines.map((l, i) => (
            <tr key={i} className="border-b border-fp-border align-top">
              <td className="whitespace-pre-line py-2 pr-3">
                {l.description}
                {l.discount_percent > 0 && <span className="block text-xs text-fp-mid">Includes {l.discount_percent}% discount</span>}
              </td>
              <td className="py-2 pr-3 text-right">{l.quantity}</td>
              <td className="py-2 pr-3 text-right">{gbp(l.unit_price)}</td>
              <td className="py-2 pr-3 text-right">{l.tax_rate}%</td>
              <td className="py-2 text-right">{gbp(l.line_net)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-4 grid max-w-xs grid-cols-2 gap-x-6 gap-y-1">
        <dt>Subtotal</dt>
        <dd className="text-right">{gbp(d.subtotal)}</dd>
        <dt>VAT</dt>
        <dd className="text-right">{gbp(d.vat_total)}</dd>
        <dt className="border-t-2 border-fp-black pt-1 text-base font-black">Total</dt>
        <dd className="border-t-2 border-fp-black pt-1 text-right text-base font-black">{gbp(d.total)}</dd>
      </dl>
        </>
      )}

      {(d.notes || d.bank_details) && (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {d.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fp-mid">Notes</p>
              <p className="mt-1 whitespace-pre-line">{d.notes}</p>
            </div>
          )}
          {d.bank_details && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fp-mid">How to pay</p>
              <p className="mt-1 whitespace-pre-line">{d.bank_details}</p>
            </div>
          )}
        </section>
      )}
      {d.terms && (
        <section className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-fp-mid">Terms</p>
          <p className="mt-1 whitespace-pre-line text-xs text-fp-dark/80">{d.terms}</p>
        </section>
      )}

      <footer className="mt-10 border-t border-fp-border pt-3 text-xs text-fp-mid">
        {d.proposal && <p className="mb-1 font-semibold text-fp-dark">Your marketing, always moving. · All prices exclude VAT unless stated.</p>}
        {[c.company_number && `Registered in England & Wales no. ${c.company_number}`, c.vat_number && `VAT no. ${c.vat_number}`]
          .filter(Boolean)
          .join(" · ")}
      </footer>
    </article>
  );
}

// A proposal's lines, one-off and monthly totals, payment schedule and next
// steps, as on Footprint's quote builder (DJ, 9 November 2026).
function ProposalBody({ d }: { d: PrintableData }) {
  const p = d.proposal!;
  const t = proposalTotals(d.lines);
  const rows = paymentSchedule(t.oneOff.total, t.monthly.total, p.planMonths, p.depositPercent);
  const next = paymentNextSteps(t.oneOff.net, t.monthly.net, p.depositPercent);
  return (
    <>
      {p.preparedBy && <p className="mt-2 text-xs text-fp-mid">Prepared by {p.preparedBy}</p>}
      <table className="mt-6 w-full text-left">
        <thead className="border-b-2 border-fp-black text-xs uppercase tracking-wide">
          <tr>
            <th className="py-2 pr-3">Item</th>
            <th className="py-2 pr-3 text-right">Qty</th>
            <th className="py-2 pr-3 text-right">Unit</th>
            <th className="py-2 pr-3 text-right">Type</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {d.lines.map((l, i) => {
            const included = l.billing === "included";
            return (
              <tr key={i} className="border-b border-fp-border align-top">
                <td className="whitespace-pre-line py-2 pr-3">
                  {l.description}
                  {l.discount_percent > 0 && <span className="block text-xs text-fp-mid">Includes {l.discount_percent}% discount</span>}
                </td>
                <td className="py-2 pr-3 text-right">{included ? "—" : l.quantity}</td>
                <td className="py-2 pr-3 text-right">{included ? "Included" : gbp(l.unit_price)}</td>
                <td className="py-2 pr-3 text-right">{billingLabel(l.billing)}</td>
                <td className="py-2 text-right">{gbp(included ? 0 : l.line_net)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <dl className="ml-auto mt-4 grid max-w-xs grid-cols-2 gap-x-6 gap-y-1">
        {t.oneOff.net > 0 && (
          <>
            <dt>One-off subtotal</dt>
            <dd className="text-right">{gbp(t.oneOff.net)}</dd>
            <dt>VAT</dt>
            <dd className="text-right">{gbp(t.oneOff.vat)}</dd>
            <dt className="border-t-2 border-fp-black pt-1 font-black">One-off total</dt>
            <dd className="border-t-2 border-fp-black pt-1 text-right font-black">{gbp(t.oneOff.total)}</dd>
          </>
        )}
        {t.monthly.net > 0 && (
          <>
            <dt className={t.oneOff.net > 0 ? "mt-3" : ""}>Monthly subtotal</dt>
            <dd className={`text-right ${t.oneOff.net > 0 ? "mt-3" : ""}`}>{gbp(t.monthly.net)}</dd>
            <dt>VAT</dt>
            <dd className="text-right">{gbp(t.monthly.vat)}</dd>
            <dt className="border-t-2 border-fp-black pt-1 font-black">Monthly total</dt>
            <dd className="border-t-2 border-fp-black pt-1 text-right font-black">{gbp(t.monthly.total)}/mo</dd>
          </>
        )}
      </dl>

      {rows.length > 0 && (
        <section className="mt-8 break-inside-avoid rounded-md border border-fp-border p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-fp-pink">{scheduleTitle(t.oneOff.total, p.planMonths, p.depositPercent)}</p>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-fp-mid">
              <tr>
                <th className="py-1 pr-3">Payment</th>
                <th className="py-1 pr-3">Due</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-t border-fp-border ${r.kind === "deposit" || r.kind === "full" ? "font-semibold" : ""}`}>
                  <td className="py-1.5 pr-3">{r.label}</td>
                  <td className="py-1.5 pr-3">{r.due}</td>
                  <td className="py-1.5 text-right">
                    {gbp(r.amount)}
                    {r.kind === "subscription" ? "/mo" : ""}
                  </td>
                </tr>
              ))}
              {t.oneOff.total > 0 && (
                <tr className="border-t-2 border-fp-black font-black">
                  <td colSpan={2} className="py-1.5">
                    Total one-off (inc. VAT)
                  </td>
                  <td className="py-1.5 text-right">{gbp(t.oneOff.total)}</td>
                </tr>
              )}
            </tbody>
          </table>
          {next && <p className="mt-3 text-xs text-fp-dark/80">{next}</p>}
        </section>
      )}
    </>
  );
}

export function customerAddress(c: Record<string, unknown> | null) {
  if (!c) return null;
  return address([
    c.billing_street as string,
    c.billing_city as string,
    c.billing_county as string,
    c.billing_postcode as string,
  ]).replace(/, /g, "\n");
}

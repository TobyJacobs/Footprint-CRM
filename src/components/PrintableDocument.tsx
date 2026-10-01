import Image from "next/image";
import { address, gbp, longDate } from "@/lib/customers/display";

export type PrintableLine = {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  line_net: number;
};

export type PrintableData = {
  label: string;
  number: string;
  title?: string | null;
  issue_date: string;
  valid_until?: string | null;
  due_date?: string | null;
  customer_reference?: string | null;
  customer: { name: string; address?: string | null; contact?: string | null };
  lines: PrintableLine[];
  subtotal: number;
  vat_total: number;
  total: number;
  notes?: string | null;
  terms?: string | null;
  bank_details?: string | null;
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
          <p className="text-xs font-semibold uppercase tracking-wide text-fp-mid">{d.label} for</p>
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
          {d.customer_reference && (
            <>
              <dt className="text-fp-mid">Your reference</dt>
              <dd>{d.customer_reference}</dd>
            </>
          )}
        </dl>
      </section>

      {d.title && <h1 className="mt-8 text-lg font-black">{d.title}</h1>}

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
        {[c.company_number && `Registered in England & Wales no. ${c.company_number}`, c.vat_number && `VAT no. ${c.vat_number}`]
          .filter(Boolean)
          .join(" · ")}
      </footer>
    </article>
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

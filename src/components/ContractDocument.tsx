import { gbp, longDate } from "@/lib/customers/display";
import { billingLabel, paymentSchedule, proposalTotals, scheduleTitle } from "@/lib/sales/proposal";

// A contract on a proposal (DJ, 16 November 2026), laid out like Footprint's
// contract builder: parties, objectives, long-term solution, scope, pricing,
// payment schedule, terms and conditions, signatures. Drawn from the data the
// database gives (contract_json / the signed copy), so the customer's link,
// the staff view and the signed copy all look the same.

export type ContractData = {
  quote_number: string;
  issue_date: string | null;
  client: string | null;
  footprint_rep: string | null;
  start_date: string | null;
  notice_days: number;
  objectives: string[];
  longterm: string[];
  signatory_name: string | null;
  signatory_title: string | null;
  plan_months: number | null;
  deposit_percent: number;
  lines: { description: string; quantity: number; unit_price: number; discount_percent: number; line_net: number; tax_rate: number; billing: string }[];
  clauses: { title: string; body: string }[];
  signed?: boolean;
  signed_by?: string | null;
  signed_at?: string | null;
  signed_ip?: string | null;
};

const signedAt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="mb-2 border-b border-fp-border pb-1 text-xs font-bold uppercase tracking-wide text-fp-mid">{title}</h2>
      {children}
    </section>
  );
}

export default function ContractDocument({ c, companyName }: { c: ContractData; companyName?: string | null }) {
  const company = companyName || "Footprint Group";
  const client = c.client || "the Client";
  const lines = c.lines.map((l) => ({ ...l, quantity: Number(l.quantity), unit_price: Number(l.unit_price), line_net: Number(l.line_net), tax_rate: Number(l.tax_rate) }));
  const t = proposalTotals(lines);
  const rows = paymentSchedule(t.oneOff.total, t.monthly.total, c.plan_months, Number(c.deposit_percent ?? 0));
  const firstLine = (d: string) => d.split("\n")[0].trim();
  const rest = (d: string) => d.split("\n").slice(1).join(" ").trim();

  return (
    <article className="mx-auto max-w-[210mm] bg-white p-8 text-sm leading-relaxed text-fp-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
      <header className="border-b-4 border-fp-black pb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-fp-mid">{company}</p>
        <h1 className="text-2xl font-black">Agreement</h1>
        <p className="text-xs text-fp-dark/75">
          Contract for proposal {c.quote_number}
          {c.issue_date ? ` · prepared ${longDate(c.issue_date)}` : ""}
        </p>
      </header>

      <Section title="Parties">
        <p>
          This Agreement is made between <strong>{company}</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;) and <strong>{client}</strong> (&ldquo;you&rdquo;),
          effective from {c.start_date ? longDate(c.start_date) : "the date it is signed"}. You are engaging {company} to deliver the services set out below.
        </p>
      </Section>

      {c.objectives.length > 0 && (
        <Section title="Objectives">
          <ul className="list-disc pl-5">
            {c.objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </Section>
      )}

      {c.longterm.length > 0 && (
        <Section title="Long-term solution">
          <ul className="list-disc pl-5">
            {c.longterm.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Scope of services">
        {lines.length ? (
          <ul className="list-disc pl-5">
            {lines.map((l, i) => (
              <li key={i}>
                <strong>{firstLine(l.description) || "Service"}</strong>
                {rest(l.description) ? `: ${rest(l.description)}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fp-mid">No services listed.</p>
        )}
      </Section>

      <Section title="Pricing">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-fp-border text-fp-mid">
            <tr>
              <th className="py-1 pr-2 font-semibold">Item</th>
              <th className="py-1 pr-2 text-right font-semibold">Qty</th>
              <th className="py-1 pr-2 text-right font-semibold">Unit</th>
              <th className="py-1 pr-2 text-right font-semibold">Type</th>
              <th className="py-1 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-fp-border last:border-0">
                <td className="py-1 pr-2">{firstLine(l.description)}</td>
                <td className="py-1 pr-2 text-right">{l.billing === "included" ? "—" : l.quantity}</td>
                <td className="py-1 pr-2 text-right">{l.billing === "included" ? "Included" : gbp(l.unit_price)}</td>
                <td className="py-1 pr-2 text-right">{billingLabel(l.billing)}</td>
                <td className="py-1 text-right">{l.billing === "included" ? gbp(0) : gbp(l.line_net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-3 grid max-w-xs grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
          {t.oneOff.net > 0 && (
            <>
              <dt>One-off subtotal</dt>
              <dd className="text-right">{gbp(t.oneOff.net)}</dd>
              <dt>VAT</dt>
              <dd className="text-right">{gbp(t.oneOff.vat)}</dd>
              <dt className="font-bold">One-off total</dt>
              <dd className="text-right font-bold">{gbp(t.oneOff.total)}</dd>
            </>
          )}
          {t.monthly.net > 0 && (
            <>
              <dt className="mt-1">Monthly subtotal</dt>
              <dd className="mt-1 text-right">{gbp(t.monthly.net)}</dd>
              <dt>VAT</dt>
              <dd className="text-right">{gbp(t.monthly.vat)}</dd>
              <dt className="font-bold">Monthly total</dt>
              <dd className="text-right font-bold">{gbp(t.monthly.total)}/mo</dd>
            </>
          )}
        </dl>
      </Section>

      <Section title={scheduleTitle(t.oneOff.total, c.plan_months, Number(c.deposit_percent ?? 0))}>
        {rows.length ? (
          <table className="w-full text-left text-xs">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-fp-border last:border-0">
                  <td className="py-1 pr-2">{r.label}</td>
                  <td className="py-1 pr-2 text-fp-dark/75">{r.due === "On acceptance" ? "On signing" : r.due}</td>
                  <td className="py-1 text-right">
                    {gbp(r.amount)}
                    {r.kind === "subscription" ? "/mo" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-fp-mid">No payment is due under this agreement.</p>
        )}
      </Section>

      <Section title="Terms & conditions">
        <ol className="grid gap-3">
          {c.clauses.map((cl, i) => (
            <li key={i} className="break-inside-avoid-page">
              <h3 className="font-bold">
                {i + 1}. {cl.title}
              </h3>
              {cl.body
                .split(/\n\s*\n/)
                .filter((p) => p.trim())
                .map((p, j) => (
                  <p key={j} className="mt-1">
                    {p.trim()}
                  </p>
                ))}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Signature">
        <p>By signing below, both parties agree to be bound by the terms of this Agreement.</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div className="border-t border-fp-black pt-2">
            <p className="text-xs text-fp-mid">For {company}</p>
            <p className="font-semibold">{c.footprint_rep || company}</p>
          </div>
          <div className="border-t border-fp-black pt-2">
            <p className="text-xs text-fp-mid">For {client}</p>
            <p className="font-semibold">
              {c.signed ? c.signed_by : c.signatory_name || "________________"}
              {c.signatory_title ? `, ${c.signatory_title}` : ""}
            </p>
            {c.signed && c.signed_at && (
              <p className="mt-1 text-xs text-fp-teal-deep">
                Signed electronically on {signedAt.format(new Date(c.signed_at))}
                {c.signed_ip ? ` (from ${c.signed_ip})` : ""}.
              </p>
            )}
          </div>
        </div>
      </Section>
    </article>
  );
}

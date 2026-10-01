import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import PrintableDocument, { type PrintableData } from "@/components/PrintableDocument";
import { inputClass } from "@/components/ui";
import { longDate } from "@/lib/customers/display";
import { createClient } from "@/lib/supabase/server";
import { respondToQuote } from "./actions";

export const metadata: Metadata = { title: "Your quote", robots: { index: false, follow: false } };

type QuoteView = {
  number: string;
  title: string | null;
  status: string;
  issue_date: string;
  valid_until: string | null;
  customer_reference: string | null;
  notes: string | null;
  terms: string | null;
  subtotal: number;
  vat_total: number;
  total: number;
  responded_at: string | null;
  response_name: string | null;
  customer_name: string;
  contact_name: string | null;
  lines: PrintableData["lines"];
  company: PrintableData["company"];
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-fp-offwhite">
      <div className="bg-fp-gradient h-1" />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}

// The page a customer sees when they open the private link to their quote.
export default async function PublicQuotePage(props: PageProps<"/q/[token]">) {
  const { token } = await props.params;
  const sp = await props.searchParams;

  let quote: QuoteView | null = null;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_quote_by_token", { p_token: token });
    quote = (data as QuoteView | null) ?? null;
  }

  if (!quote) {
    return (
      <Shell>
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-black">Quote not found</h1>
          <p className="mt-2 text-fp-dark/75">This link isn&apos;t valid. Please check it, or contact us and we&apos;ll send a new one.</p>
        </div>
      </Shell>
    );
  }

  const expired = quote.status === "sent" && quote.valid_until !== null && quote.valid_until < new Date().toISOString().slice(0, 10);
  const canRespond = quote.status === "sent" && !expired;
  const error = typeof sp.error === "string" ? sp.error : null;
  const done = sp.done === "accepted" || sp.done === "declined" ? sp.done : null;
  const company = quote.company?.company_name ?? "Footprint Group";

  return (
    <Shell>
      {(done || quote.status === "accepted" || quote.status === "converted") && quote.status !== "declined" && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-fp-teal-deep/30 bg-fp-teal/10 p-5">
          <CheckCircle2 className="mt-0.5 shrink-0 text-fp-teal-deep" aria-hidden />
          <div>
            <p className="font-bold">Thank you — this quote has been accepted.</p>
            <p className="text-sm text-fp-dark/80">
              {quote.response_name ? `Accepted by ${quote.response_name}` : "Accepted"}
              {quote.responded_at ? ` on ${longDate(quote.responded_at)}` : ""}. {company} will be in touch to get things moving.
            </p>
          </div>
        </div>
      )}
      {quote.status === "declined" && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-fp-border bg-white p-5">
          <XCircle className="mt-0.5 shrink-0 text-fp-mid" aria-hidden />
          <div>
            <p className="font-bold">This quote was declined.</p>
            <p className="text-sm text-fp-dark/80">Thanks for letting us know. If anything changes, just get in touch.</p>
          </div>
        </div>
      )}
      {expired && (
        <div className="mb-6 rounded-lg border border-fp-amber bg-fp-amber/10 p-5 text-sm">
          This quote expired on {longDate(quote.valid_until)}. Please contact us for an updated quote.
        </div>
      )}

      <PrintableDocument
        d={{
          label: "Quote",
          number: quote.number,
          title: quote.title,
          issue_date: quote.issue_date,
          valid_until: quote.valid_until,
          customer_reference: quote.customer_reference,
          customer: { name: quote.customer_name, contact: quote.contact_name },
          lines: quote.lines,
          subtotal: Number(quote.subtotal),
          vat_total: Number(quote.vat_total),
          total: Number(quote.total),
          notes: quote.notes,
          terms: quote.terms,
          company: quote.company,
        }}
      />

      {canRespond && (
        <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black">Happy to go ahead?</h2>
          <p className="mt-1 text-sm text-fp-dark/75">
            Type your name and choose Accept or Decline. Accepting confirms you&apos;d like {company} to go ahead on the terms above.
          </p>
          {error && (
            <p role="alert" className="mt-4 rounded-md border border-fp-error/30 bg-fp-error/5 px-3 py-2 text-sm text-fp-error">
              {error}
            </p>
          )}
          <form className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Your full name</span>
              <input name="name" required minLength={2} autoComplete="name" className={inputClass} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Your purchase order number (optional)</span>
              <input name="po" className={inputClass} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Anything we should know? (optional)</span>
              <textarea name="note" rows={3} className={inputClass} />
            </label>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                formAction={respondToQuote.bind(null, token, true)}
                className="rounded-md bg-fp-teal-deep px-5 py-2.5 text-sm font-bold text-white hover:bg-fp-teal-deep/90"
              >
                Accept quote
              </button>
              <button
                formAction={respondToQuote.bind(null, token, false)}
                formNoValidate={false}
                className="rounded-md border border-fp-border bg-white px-5 py-2.5 text-sm font-semibold hover:bg-fp-light"
              >
                Decline
              </button>
            </div>
          </form>
        </section>
      )}

      <p className="mt-8 text-center text-xs text-fp-mid">
        {company}
        {quote.company?.phone && ` · ${quote.company.phone}`}
        {quote.company?.email && ` · ${quote.company.email}`}
      </p>
    </Shell>
  );
}

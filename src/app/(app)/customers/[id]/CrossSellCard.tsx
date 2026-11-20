import Link from "next/link";
import { Check, FileText, Phone, Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { gbp, longDate } from "@/lib/customers/display";
import { buysService, type CrossSell, type CrossSellRow } from "@/lib/customers/cross-sell";
import { addToServiceStack, setCrossSellInterest } from "../actions";

// Cross-sell (owner, 20 November 2026): each of Footprint's services, ticked
// when the customer buys it, otherwise shown as an opportunity with quick
// buttons. Only shown to people who can see sales.

// Which kind of quote suits each service.
const quoteKind = (s: string) =>
  s === "Advertising" ? "advertising" : ["Web", "Digital Marketing", "Social", "YLK"].includes(s) ? "proposal" : "quote";

const small = "inline-flex items-center gap-1 rounded-md border border-fp-border bg-white px-2 py-1 text-xs font-semibold hover:border-fp-pink/40 hover:bg-fp-light";
const link = "block text-xs leading-5 font-semibold text-fp-dark/70 underline hover:text-fp-black";

function Evidence({ r }: { r: CrossSellRow }) {
  const bits: React.ReactNode[] = [];
  if (r.spend) bits.push(`${gbp(r.spend)} invoiced`);
  if (r.lastDoc && r.lastDate)
    bits.push(
      <span key="last">
        last on{" "}
        <Link href={`/sales/${r.lastDoc.id}`} className="font-semibold text-fp-teal-deep hover:underline">
          {r.lastDoc.number}
        </Link>
        , {longDate(r.lastDate)}
      </span>,
    );
  if (r.other) bits.push(r.other);
  if (!bits.length && r.ticked) bits.push("In their Service Stack");
  return (
    <span className="text-xs text-fp-dark/70">
      {bits.map((b, i) => (
        <span key={i}>
          {i > 0 && " · "}
          {b}
        </span>
      ))}
    </span>
  );
}

export default function CrossSellCard({
  customerId,
  data,
  can,
}: {
  customerId: string;
  data: CrossSell;
  can: { quote: boolean; mark: boolean; editCustomer: boolean };
}) {
  const buying = data.rows.filter(buysService);
  const open = data.rows.filter((r) => !buysService(r) && !r.dismissed);
  const notInterested = data.rows.filter((r) => !buysService(r) && r.dismissed);
  const lapsed = buying.filter((r) => r.lapsed);

  return (
    <div id="cross-sell" className="scroll-mt-24">
      <Card
        title="Cross-sell"
        action={
          <span className="text-xs font-semibold text-fp-mid">
            Buys {data.buying} of {data.rows.length} services · {data.opportunities} opportunit{data.opportunities === 1 ? "y" : "ies"}
          </span>
        }
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">Opportunities</h3>
            {open.length === 0 ? (
              <p className="text-sm text-fp-mid">None left: they buy everything else or aren&apos;t interested.</p>
            ) : (
              <ul className="grid gap-2">
                {open.map((r) => (
                  <li key={r.service} className="rounded-md border border-fp-pink/25 bg-fp-pink/5 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Sparkles size={14} aria-hidden className="text-fp-pink" />
                      <span className="font-semibold">{r.service}</span>
                      <span className="ml-auto flex flex-wrap items-center gap-1.5">
                        {can.quote && (
                          <Link href={`/sales/new?type=quote&kind=${quoteKind(r.service)}&customer=${customerId}`} className={small}>
                            <FileText size={12} aria-hidden className="text-fp-pink" /> Quote
                          </Link>
                        )}
                        <Link href={`/customers/${customerId}?log=call#timeline`} className={small}>
                          <Phone size={12} aria-hidden className="text-fp-pink" /> Log a call
                        </Link>
                      </span>
                    </div>
                    {(can.mark || can.editCustomer) && (
                      <div className="mt-1.5 flex flex-wrap items-start gap-x-4 gap-y-1">
                        {can.mark && (
                          <details className="group">
                            <summary className={`${link} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>Not interested</summary>
                            <form action={setCrossSellInterest.bind(null, customerId, r.service, false)} className="mt-1.5 flex flex-wrap gap-1.5">
                              <input
                                name="reason"
                                maxLength={300}
                                placeholder="Why? (optional)"
                                aria-label={`Why they're not interested in ${r.service}`}
                                className="min-w-0 flex-1 rounded-md border border-fp-border px-2 py-1 text-xs"
                              />
                              <button className={small}>Save</button>
                            </form>
                          </details>
                        )}
                        {can.editCustomer && (
                          <form action={addToServiceStack.bind(null, customerId, r.service)}>
                            <button className={link}>They already buy this</button>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">Already buys</h3>
            {buying.length === 0 ? (
              <p className="text-sm text-fp-mid">Nothing yet.</p>
            ) : (
              <ul className="grid gap-1.5">
                {buying.map((r) => (
                  <li key={r.service} className="flex flex-wrap items-baseline gap-x-2">
                    <Check size={14} aria-hidden className="shrink-0 translate-y-0.5 text-fp-teal-deep" />
                    <span className="font-semibold">{r.service}</span>
                    {r.lapsed && <span className="rounded bg-fp-amber/20 px-1.5 text-[11px] font-bold text-fp-dark">Not for over a year</span>}
                    <Evidence r={r} />
                  </li>
                ))}
              </ul>
            )}
            {lapsed.length > 0 && (
              <p className="mt-2 text-xs text-fp-dark/70">Worth a call to win back: {lapsed.map((r) => r.service).join(", ")}.</p>
            )}

            {notInterested.length > 0 && (
              <>
                <h3 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-fp-mid">Not interested</h3>
                <ul className="grid gap-1.5">
                  {notInterested.map((r) => (
                    <li key={r.service} className="flex flex-wrap items-baseline gap-x-2 text-sm text-fp-dark/70">
                      <span className="font-semibold">{r.service}</span>
                      <span className="text-xs">
                        {r.dismissed!.reason ? `${r.dismissed!.reason} · ` : ""}since {longDate(r.dismissed!.at)}
                      </span>
                      {can.mark && (
                        <form action={setCrossSellInterest.bind(null, customerId, r.service, true)}>
                          <button className={link}>Suggest again</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <p className="mt-4 text-xs text-fp-mid">
          Worked out from their Service Stack, orders and invoices, hosting plans and retainers. Older orders without a product type are matched by their wording, so check anything that looks wrong.
        </p>
      </Card>
    </div>
  );
}

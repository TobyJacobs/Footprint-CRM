"use client";

import { useMemo, useState } from "react";
import { DEPOSIT_PERCENT, depositAvailable } from "@/lib/magazine-deposit";
import { MONTH_CHOICES, availabilityLabel, bookingOptions, canBook, monthName, planBooking, startMonths, type BookingSetup } from "@/lib/online-booking";

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const input =
  "w-full rounded-md border border-fp-border bg-white px-3 py-2 text-sm focus:border-fp-pink focus:outline-none focus:ring-2 focus:ring-fp-pink/20";
const tone: Record<string, string> = {
  available: "bg-fp-teal/15 text-fp-teal-deep",
  limited: "bg-fp-amber/25 text-fp-dark",
  full: "bg-fp-error/10 text-fp-error",
  taken: "bg-fp-error/10 text-fp-error",
  closed: "bg-fp-light text-fp-mid",
  not_open: "bg-fp-light text-fp-mid",
};

// The booking page (owner, 18 November 2026): choose editions, size, length
// and start month; live prices and availability; then your details. The
// server works the prices out again when it's sent.
export default function BookingForm({
  setup,
  today,
  action,
  stamp,
}: {
  setup: BookingSetup;
  today: string;
  action: (fd: FormData) => Promise<void>;
  stamp: string;
}) {
  const options = useMemo(() => bookingOptions(setup), [setup]);
  const starts = useMemo(() => startMonths(setup), [setup]);
  const [editionIds, setEditionIds] = useState<string[]>([]);
  const [optionKey, setOptionKey] = useState(options.find((o) => o.label.toLowerCase().startsWith("half page"))?.key ?? options[0]?.key ?? "");
  const [months, setMonths] = useState<number>(1);
  const [start, setStart] = useState(starts[0] ?? "");
  const plan = useMemo(() => planBooking(setup, { editionIds, optionKey, months, start }), [setup, editionIds, optionKey, months, start]);
  const deposit = start ? depositAvailable(today, `${start}-01`) : false;
  const toggle = (id: string) => setEditionIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <form action={action} className="grid gap-6 text-sm">
      <input type="hidden" name="t" value={stamp} />
      <input type="hidden" name="editions" value={editionIds.join(",")} />
      <input type="hidden" name="option" value={optionKey} />
      <input type="hidden" name="months" value={months} />
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="page" value="" />
      {/* Spam trap: people never see or fill this. */}
      <div aria-hidden className="absolute -left-[9999px] top-0 h-0 overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <section className="grid gap-2">
        <h2 className="text-base font-bold">1. Choose your editions</h2>
        <div className="flex gap-3 text-xs">
          <button type="button" className="font-semibold text-fp-teal-deep hover:underline" onClick={() => setEditionIds(setup.editions.map((e) => e.id))}>
            All {setup.editions.length}
          </button>
          <button type="button" className="font-semibold text-fp-teal-deep hover:underline" onClick={() => setEditionIds([])}>
            Clear
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {setup.editions.map((e) => {
            const status = plan.perEdition.find((p) => p.edition.id === e.id)?.status;
            return (
              <label key={e.id} className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${editionIds.includes(e.id) ? "border-fp-pink bg-fp-pink/5" : "border-fp-border bg-white"}`}>
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={editionIds.includes(e.id)} onChange={() => toggle(e.id)} className="accent-fp-pink" />
                  <span>
                    <span className="font-semibold">{e.name}</span>
                    {e.distribution ? <span className="block text-xs text-fp-mid">~{e.distribution.toLocaleString("en-GB")} homes a month</span> : null}
                  </span>
                </span>
                {status && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone[status]}`}>{availabilityLabel[status]}</span>}
              </label>
            );
          })}
        </div>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-bold">2. Choose your advert</h2>
        <select value={optionKey} onChange={(e) => setOptionKey(e.target.value)} className={input} aria-label="Advert size or position">
          <optgroup label="Advert sizes">
            {options.filter((o) => !o.premium).map((o) => (
              <option key={o.key} value={o.key}>
                {o.label} ({o.note})
              </option>
            ))}
          </optgroup>
          {options.some((o) => o.premium) && (
            <optgroup label="Premium positions">
              {options.filter((o) => o.premium).map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <h2 className="text-base font-bold">3. How long?</h2>
          <div className="flex flex-wrap gap-2">
            {MONTH_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`rounded-md border px-3 py-2 font-semibold ${months === m ? "border-fp-pink bg-fp-pink/5" : "border-fp-border bg-white"}`}
              >
                {m} month{m === 1 ? "" : "s"}
              </button>
            ))}
          </div>
          <p className="text-xs text-fp-mid">6 months or more uses the lower long-term rate.</p>
        </div>
        <div className="grid content-start gap-2">
          <h2 className="text-base font-bold">4. Start month</h2>
          <select value={start} onChange={(e) => setStart(e.target.value)} className={input} aria-label="Start month">
            {starts.map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-fp-border bg-fp-offwhite p-4">
        <h2 className="text-base font-bold">Your price</h2>
        {!editionIds.length ? (
          <p className="text-fp-mid">Choose at least one edition to see your price.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
              <dt>Per month ({plan.editions.length} edition{plan.editions.length === 1 ? "" : "s"})</dt>
              <dd className="text-right font-semibold">{money.format(plan.perMonth)}</dd>
              <dt>
                Total for {months} month{months === 1 ? "" : "s"} (before VAT)
              </dt>
              <dd className="text-right text-lg font-black">{money.format(plan.total)}</dd>
              <dt className="text-fp-mid">VAT (20%)</dt>
              <dd className="text-right text-fp-mid">{money.format(plan.vat)}</dd>
            </dl>
            <p className="text-xs text-fp-dark/75">
              {deposit
                ? `Starting ${monthName(start)}: once we confirm your space you can pay a ${DEPOSIT_PERCENT}% deposit and the rest before your first issue goes to print.`
                : "Starting within the next two months: full payment is needed once we confirm your space."}{" "}
              Nothing is payable until we confirm.
            </p>
            {plan.perEdition.some((p) => !canBook(p.status)) && (
              <p role="alert" className="rounded-md bg-fp-error/5 px-3 py-2 text-xs text-fp-error">
                {plan.perEdition
                  .filter((p) => !canBook(p.status))
                  .map((p) => `${p.edition.name}: ${availabilityLabel[p.status].toLowerCase()} in ${p.months.filter((m) => !canBook(m.status)).map((m) => monthName(m.month)).join(", ")}`)
                  .join(". ")}
                . Please change your editions, advert or months.
              </p>
            )}
            {plan.missingPrice && <p className="text-xs text-fp-error">We can&apos;t price this option online. Please call us on 01329 288822.</p>}
          </>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-base font-bold">5. Your details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="font-semibold">Business name</span>
            <input name="company" required maxLength={200} autoComplete="organization" className={input} />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">Your name</span>
            <input name="name" required maxLength={200} autoComplete="name" className={input} />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">Email</span>
            <input name="email" type="email" required maxLength={254} autoComplete="email" className={input} />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">Phone</span>
            <input name="phone" type="tel" required maxLength={50} autoComplete="tel" className={input} />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">Address (optional)</span>
            <input name="street" maxLength={200} autoComplete="street-address" className={input} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="font-semibold">Town</span>
              <input name="city" maxLength={100} autoComplete="address-level2" className={input} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">Postcode</span>
              <input name="postcode" maxLength={12} autoComplete="postal-code" className={input} />
            </label>
          </div>
        </div>
        <label className="grid gap-1">
          <span className="font-semibold">Your advert artwork</span>
          <select name="artwork" className={input} defaultValue="Please design it for me">
            <option>Please design it for me</option>
            <option>I&apos;ll send my own artwork</option>
            <option>Same as my last advert</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Anything else we should know? (optional)</span>
          <textarea name="message" rows={3} maxLength={2000} className={input} />
        </label>
        <p className="text-xs text-fp-dark/75">
          This is a request, not a confirmed booking. We&apos;ll check availability and confirm your space and final price by email within one working day.
          We use your details only to deal with your booking.
        </p>
        <div>
          <button
            type="submit"
            disabled={!plan.ok}
            className="rounded-md bg-fp-pink px-5 py-2.5 text-sm font-bold text-white hover:bg-fp-pink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Request my space
          </button>
        </div>
      </section>
    </form>
  );
}

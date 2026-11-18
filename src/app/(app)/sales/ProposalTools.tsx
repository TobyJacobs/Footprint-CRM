"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { inputClass } from "@/components/ui";
import { billingLabel, depositOptions, paymentSchedule, planOptions, proposalTotals, scheduleTitle } from "@/lib/sales/proposal";
import type { ProductHit } from "./DocumentEditor";
import { loadProducts } from "./ProductDropdown";

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

// Proposals (DJ, 9 November 2026): the product catalogue, by group, as on
// Footprint's quote builder. Products with a group (Products → Group) show here.
export function ProposalCatalogue({ onAdd }: { onAdd: (p: ProductHit) => void }) {
  const [products, setProducts] = useState<ProductHit[]>([]);
  const [group, setGroup] = useState("All");
  useEffect(() => {
    let live = true;
    loadProducts().then((ps) => {
      if (live) setProducts(ps.filter((p) => p.category));
    });
    return () => {
      live = false;
    };
  }, []);
  if (products.length === 0) return null;
  const groups = ["All", ...Array.from(new Set(products.map((p) => p.category as string)))];
  const shown = group === "All" ? products : products.filter((p) => p.category === group);
  return (
    <section className="rounded-lg border border-fp-border p-4">
      <h3 className="mb-3 font-bold">Add products &amp; services</h3>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Catalogue groups">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={g === group}
            onClick={() => setGroup(g)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${g === group ? "border-fp-black bg-fp-black text-white" : "border-fp-border bg-white hover:border-fp-pink"}`}
          >
            {g}
          </button>
        ))}
      </div>
      <ul className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {shown.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-3 rounded-md border border-fp-border bg-white p-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-semibold">{p.name}</p>
              {p.description && <p className="line-clamp-2 text-xs text-fp-dark/70">{p.description}</p>}
              <p className="mt-1 text-xs">
                <span className="font-semibold">{p.billing === "included" ? "Included" : money.format(p.sale_price)}</span>
                {p.billing === "monthly" && <span className="text-fp-mid"> /month</span>}
                {p.billing === "oneoff" && <span className="text-fp-mid"> one-off</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAdd(p)}
              aria-label={`Add ${p.name}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-fp-border px-2 py-1 text-xs font-semibold hover:border-fp-pink hover:bg-fp-light"
            >
              <Plus size={12} aria-hidden /> Add
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// One-off and monthly totals, the payment plan and deposit choices, and the
// schedule the customer will see. The choices are saved with the proposal.
export function ProposalPayments({
  lines,
  initialPlan,
  initialDeposit,
}: {
  lines: { billing?: string | null; line_net: number; tax_rate: number }[];
  initialPlan: number | null;
  initialDeposit: number;
}) {
  const [plan, setPlan] = useState<number | null>(initialPlan);
  const [deposit, setDeposit] = useState(initialDeposit);
  const t = proposalTotals(lines);
  const rows = paymentSchedule(t.oneOff.total, t.monthly.total, plan, deposit);
  const choice = (active: boolean) =>
    `rounded-md border px-3 py-2 text-left text-sm ${active ? "border-fp-pink bg-fp-pink/5 font-semibold" : "border-fp-border bg-white hover:border-fp-pink/50"}`;
  return (
    <section className="grid gap-5 rounded-lg border border-fp-border p-4 lg:grid-cols-2">
      <input type="hidden" name="plan_months" value={plan ?? ""} />
      <input type="hidden" name="deposit_percent" value={deposit} />
      <div className="grid content-start gap-4">
        <div>
          <h3 className="font-bold">Payment plan (one-off costs)</h3>
          <p className="mb-2 text-xs text-fp-mid">Interest-free instalments for one-off project and setup costs. Monthly costs bill separately.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {planOptions.map((o) => (
              <button key={o.label} type="button" onClick={() => setPlan(o.value)} className={choice(plan === o.value)}>
                {o.label}
                <span className="block text-xs font-normal text-fp-mid">{o.note}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-bold">Deposit (one-off costs)</h3>
          <p className="mb-2 text-xs text-fp-mid">Taken on acceptance; never on monthly subscriptions.</p>
          <div className="grid grid-cols-3 gap-2">
            {depositOptions.map((o) => (
              <button key={o.value} type="button" onClick={() => setDeposit(o.value)} className={choice(deposit === o.value)}>
                {o.label}
                <span className="block text-xs font-normal text-fp-mid">{o.note}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid content-start gap-3 text-sm">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
          {t.oneOff.net > 0 && (
            <>
              <dt className="text-fp-dark/75">One-off subtotal</dt>
              <dd className="text-right">{money.format(t.oneOff.net)}</dd>
              <dt className="text-fp-dark/75">VAT</dt>
              <dd className="text-right">{money.format(t.oneOff.vat)}</dd>
              <dt className="font-bold">One-off total</dt>
              <dd className="text-right font-bold">{money.format(t.oneOff.total)}</dd>
            </>
          )}
          {t.monthly.net > 0 && (
            <>
              <dt className="mt-2 text-fp-dark/75">Monthly subtotal</dt>
              <dd className="mt-2 text-right">{money.format(t.monthly.net)}</dd>
              <dt className="text-fp-dark/75">VAT</dt>
              <dd className="text-right">{money.format(t.monthly.vat)}</dd>
              <dt className="font-bold">Monthly total</dt>
              <dd className="text-right font-bold">{money.format(t.monthly.total)}/mo</dd>
            </>
          )}
        </dl>
        {rows.length > 0 && (
          <div className="rounded-md bg-fp-offwhite p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">{scheduleTitle(t.oneOff.total, plan, deposit)}</p>
            <table className="w-full text-xs">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-fp-border last:border-0">
                    <td className="py-1 pr-2">{r.label}</td>
                    <td className="py-1 pr-2 text-fp-mid">{r.due}</td>
                    <td className="py-1 text-right font-semibold">
                      {money.format(r.amount)}
                      {r.kind === "subscription" ? "/mo" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-fp-mid">The customer sees this schedule on the proposal. Invoices are raised as usual.</p>
      </div>
    </section>
  );
}

// The Type box on a proposal line.
export function BillingSelect({ value, onChange }: { value: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <select value={value ?? "oneoff"} onChange={(e) => onChange(e.target.value)} aria-label="Type" className={inputClass}>
      {(["oneoff", "monthly", "included"] as const).map((b) => (
        <option key={b} value={b}>
          {billingLabel(b)}
        </option>
      ))}
    </select>
  );
}

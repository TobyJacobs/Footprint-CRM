"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { inputClass } from "@/components/ui";
import ProductDropdown, { productLineText } from "../ProductDropdown";

type TaxRate = { id: string; name: string; rate: number };
export type PoEditorLine = {
  key: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  tax_rate_id: string | null;
  tax_rate: number;
};

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
let counter = 0;
const newKey = () => `p${Date.now()}-${counter++}`;
const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// The lines of a purchase order: what we're buying, how many, at our cost.
export default function PoLinesEditor({ initialLines, taxRates }: { initialLines: PoEditorLine[]; taxRates: TaxRate[] }) {
  const defaultTax = taxRates[0];
  const blank = (): PoEditorLine => ({
    key: newKey(),
    product_id: null,
    description: "",
    quantity: 1,
    unit_cost: 0,
    tax_rate_id: defaultTax?.id ?? null,
    tax_rate: defaultTax?.rate ?? 0,
  });
  const [lines, setLines] = useState<PoEditorLine[]>(initialLines.length ? initialLines : [blank()]);
  const update = (key: string, patch: Partial<PoEditorLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  let subtotal = 0;
  let vat = 0;
  for (const l of lines) {
    const net = round2(l.quantity * l.unit_cost);
    subtotal += net;
    vat += round2((net * l.tax_rate) / 100);
  }
  subtotal = round2(subtotal);
  vat = round2(vat);

  return (
    <div className="grid gap-4">
      <input
        type="hidden"
        name="lines_json"
        value={JSON.stringify(
          lines
            .filter((l) => l.description.trim() || l.unit_cost || l.product_id)
            .map((l) => ({
              product_id: l.product_id,
              description: l.description,
              quantity: l.quantity,
              unit_cost: l.unit_cost,
              tax_rate_id: l.tax_rate_id,
              tax_rate: l.tax_rate,
            })),
        )}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="py-2 pr-2 font-semibold">Item</th>
              <th className="w-20 py-2 pr-2 font-semibold">Qty</th>
              <th className="w-28 py-2 pr-2 font-semibold">Our cost £</th>
              <th className="w-36 py-2 pr-2 font-semibold">VAT</th>
              <th className="w-28 py-2 pr-2 text-right font-semibold">Net</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-b border-fp-border align-top">
                <td className="py-2 pr-2">
                  <div className="grid gap-1">
                    <ProductDropdown
                      selectedId={l.product_id}
                      onPick={(p) =>
                        update(l.key, {
                          product_id: p.id,
                          description: productLineText(p),
                          unit_cost: p.cost_price ?? 0,
                          tax_rate_id: p.tax_rate_id ?? l.tax_rate_id,
                          tax_rate: p.tax_rate_id ? p.tax_rate : l.tax_rate,
                        })
                      }
                    />
                    <textarea
                      value={l.description}
                      onChange={(e) => update(l.key, { description: e.target.value })}
                      rows={2}
                      placeholder="Description"
                      className={inputClass}
                    />
                  </div>
                </td>
                <td className="py-2 pr-2">
                  <input type="number" step="any" value={l.quantity} onChange={(e) => update(l.key, { quantity: num(e.target.value) })} className={inputClass} />
                </td>
                <td className="py-2 pr-2">
                  <input type="number" step="0.01" value={l.unit_cost} onChange={(e) => update(l.key, { unit_cost: num(e.target.value) })} className={inputClass} />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={l.tax_rate_id ?? ""}
                    onChange={(e) => {
                      const r = taxRates.find((x) => x.id === e.target.value);
                      update(l.key, { tax_rate_id: r?.id ?? null, tax_rate: r?.rate ?? 0 });
                    }}
                    className={inputClass}
                  >
                    {taxRates.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2 pt-4 text-right font-semibold">{money.format(round2(l.quantity * l.unit_cost))}</td>
                <td className="py-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blank()]))}
                    className="rounded p-1 text-fp-mid hover:bg-fp-light hover:text-fp-error"
                    aria-label="Remove line"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, blank()])}
          className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline"
        >
          <Plus size={14} /> Add line
        </button>
        <dl className="grid min-w-[240px] grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-fp-dark/75">Subtotal</dt>
          <dd className="text-right">{money.format(subtotal)}</dd>
          <dt className="text-fp-dark/75">VAT</dt>
          <dd className="text-right">{money.format(vat)}</dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-right font-bold">{money.format(round2(subtotal + vat))}</dd>
        </dl>
      </div>
    </div>
  );
}

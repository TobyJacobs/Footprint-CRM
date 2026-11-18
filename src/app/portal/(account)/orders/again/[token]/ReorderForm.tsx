"use client";

import { useState } from "react";

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const input =
  "w-24 rounded-md border border-fp-border bg-white px-2 py-1.5 text-right text-sm focus:border-fp-pink focus:outline-none focus:ring-2 focus:ring-fp-pink/20";

export type ReorderItem = { id: string; description: string; quantity: number; unit_price: number; billing: string };

// Order again (owner, 18 November 2026): change quantities (0 leaves it out),
// see the guide total, add a note.
export default function ReorderForm({ items, action }: { items: ReorderItem[]; action: (fd: FormData) => Promise<void> }) {
  const [qty, setQty] = useState<Record<string, number>>(Object.fromEntries(items.map((i) => [i.id, Number(i.quantity)])));
  const total = items.reduce((s, i) => s + (qty[i.id] || 0) * Number(i.unit_price), 0);
  const chosen = items.filter((i) => (qty[i.id] || 0) > 0).length;
  return (
    <form action={action} className="grid gap-4 text-sm">
      <input type="hidden" name="items" value={JSON.stringify(items.map((i) => ({ id: i.id, quantity: qty[i.id] || 0 })))} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left">
          <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="py-2 pr-3 font-semibold">Item</th>
              <th className="py-2 pr-3 text-right font-semibold">Price each</th>
              <th className="py-2 text-right font-semibold">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-fp-border align-top last:border-0">
                <td className="whitespace-pre-line py-2 pr-3">
                  {i.description}
                  {i.billing === "monthly" && <span className="block text-xs text-fp-mid">Monthly</span>}
                </td>
                <td className="py-2 pr-3 text-right">{money.format(Number(i.unit_price))}</td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={qty[i.id] ?? 0}
                    onChange={(e) => setQty((q) => ({ ...q, [i.id]: Math.max(0, Number(e.target.value) || 0) }))}
                    aria-label={`Quantity of ${i.description.split("\n")[0]}`}
                    className={input}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-right">
        Guide total: <strong>{money.format(Math.round(total * 100) / 100)}</strong> <span className="text-fp-mid">before VAT</span>
      </p>
      <label className="grid gap-1">
        <span className="font-semibold">Anything we should know? (optional)</span>
        <textarea name="note" rows={3} maxLength={2000} placeholder="e.g. same design, new phone number on the back" className="rounded-md border border-fp-border px-3 py-2" />
      </label>
      <p className="text-xs text-fp-dark/75">
        Set a quantity to 0 to leave an item out. Prices are today&apos;s and are confirmed by us. We&apos;ll check it and send you the quote within one
        working day; it will appear under Quotes for you to accept.
      </p>
      <div>
        <button type="submit" disabled={!chosen} className="rounded-md bg-fp-pink px-5 py-2.5 text-sm font-bold text-white hover:bg-fp-pink/90 disabled:opacity-50">
          Request this order
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Newspaper } from "lucide-react";
import { inputClass, secondaryButton } from "@/components/ui";
import { adSizes, knownEditions } from "@/lib/sales/options";

export type AdvertLine = { description: string; quantity: number; unit_price: number; unit_cost: number | null };

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};

// Advertising quotes: build the lines from the advert's size, editions and
// months: one line per month, the quantity being the number of editions.
export default function AdvertBuilder({ firstMonth, onAdd }: { firstMonth: string; onAdd: (lines: AdvertLine[]) => void }) {
  const [size, setSize] = useState(adSizes[1]);
  const [editions, setEditions] = useState<string[]>([]);
  const [otherEditions, setOtherEditions] = useState("");
  const [start, setStart] = useState(firstMonth);
  const [months, setMonths] = useState(1);
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");

  const chosen = [...editions, ...otherEditions.split(",").map((e) => e.trim()).filter(Boolean)];
  const ready = chosen.length > 0 && /^\d{4}-\d{2}$/.test(start) && months >= 1 && Number(price) > 0;

  const add = () => {
    if (!ready) return;
    const where = chosen.length === 1 ? `${chosen[0]} edition` : `${chosen.length} editions (${chosen.join(", ")})`;
    onAdd(
      Array.from({ length: months }, (_, i) => ({
        description: `${size} advert – Forget Me Not, ${where} – ${monthLabel(addMonths(start, i))}`,
        quantity: chosen.length,
        unit_price: Math.round(Number(price) * 100) / 100,
        unit_cost: cost === "" ? null : Math.round(Number(cost) * 100) / 100,
      })),
    );
  };

  return (
    <section className="mb-5 rounded-lg border border-fp-pink/30 bg-fp-pink/5 p-4">
      <h3 className="mb-3 flex items-center gap-2 font-bold">
        <Newspaper size={16} aria-hidden className="text-fp-pink" /> Advert in Forget Me Not
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Ad size</span>
          <select value={size} onChange={(e) => setSize(e.target.value)} className={inputClass}>
            {adSizes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">First month</span>
          <input type="month" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Number of months</span>
          <input type="number" min={1} max={24} value={months} onChange={(e) => setMonths(Math.max(1, Math.min(24, Number(e.target.value) || 1)))} className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Price per edition £</span>
            <input type="number" step="0.01" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Cost £</span>
            <input type="number" step="0.01" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Optional" className={inputClass} />
          </label>
        </div>
      </div>
      <fieldset className="mt-3 text-sm">
        <legend className="mb-1 font-semibold">Editions</legend>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {knownEditions.map((e) => (
            <label key={e} className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={editions.includes(e)}
                onChange={(ev) => setEditions((list) => (ev.target.checked ? [...list, e] : list.filter((x) => x !== e)))}
                className="accent-fp-pink"
              />
              {e}
            </label>
          ))}
          <input
            value={otherEditions}
            onChange={(e) => setOtherEditions(e.target.value)}
            placeholder="Other editions, separated by commas"
            className={`${inputClass} max-w-xs`}
          />
        </div>
      </fieldset>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={add} disabled={!ready} className={`${secondaryButton} disabled:cursor-not-allowed disabled:opacity-50`}>
          Add {months} advert line{months === 1 ? "" : "s"} to the quote
        </button>
        <span className="text-xs text-fp-mid">
          {ready
            ? `${months} × ${size}, ${chosen.length} edition${chosen.length === 1 ? "" : "s"} at £${Number(price).toFixed(2)} each = £${(months * chosen.length * Number(price)).toFixed(2)} before VAT`
            : "Choose at least one edition and a price."}
        </span>
      </div>
    </section>
  );
}

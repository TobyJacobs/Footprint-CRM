"use client";

import { useState } from "react";
import { Newspaper } from "lucide-react";
import { inputClass, secondaryButton } from "@/components/ui";
import type { AdvertSetup } from "@/lib/magazines";

export type AdvertLine = {
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  magazine_issue_id: string;
  advert_size_id: string;
};

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};

// Advertising quotes: pick the size, editions and months, and it adds one line
// per edition per month, each tagged with its issue and size, so the
// Magazines dashboard can count it once the quote becomes an order.
export default function AdvertBuilder({ firstMonth, setup, onAdd }: { firstMonth: string; setup: AdvertSetup; onAdd: (lines: AdvertLine[]) => void }) {
  const [sizeId, setSizeId] = useState(setup.sizes[0]?.id ?? "");
  const [editions, setEditions] = useState<string[]>([]);
  const [start, setStart] = useState(firstMonth);
  const [months, setMonths] = useState(1);
  const [price, setPrice] = useState(setup.sizes[0]?.default_price != null ? String(setup.sizes[0].default_price) : "");
  const [cost, setCost] = useState("");

  const size = setup.sizes.find((s) => s.id === sizeId);
  const chosen = setup.editions.filter((e) => editions.includes(e.id));
  const monthList = /^\d{4}-\d{2}$/.test(start) ? Array.from({ length: months }, (_, i) => addMonths(start, i)) : [];
  const issueFor = (editionId: string, ym: string) => setup.issues.find((i) => i.edition_id === editionId && i.month.startsWith(ym));
  const missing = chosen.flatMap((e) => monthList.filter((ym) => !issueFor(e.id, ym)).map((ym) => `${e.name} ${monthLabel(ym)}`));
  const ready = !!size && chosen.length > 0 && monthList.length > 0 && Number(price) > 0 && missing.length === 0;

  const pickSize = (id: string) => {
    setSizeId(id);
    const s = setup.sizes.find((x) => x.id === id);
    if (s?.default_price != null) setPrice(String(s.default_price));
  };

  const add = () => {
    if (!ready || !size) return;
    onAdd(
      monthList.flatMap((ym) =>
        chosen.map((e) => ({
          description: `${size.name} advert – Forget Me Not ${e.code}. ${e.name} – ${monthLabel(ym)}`,
          quantity: 1,
          unit_price: Math.round(Number(price) * 100) / 100,
          unit_cost: cost === "" ? null : Math.round(Number(cost) * 100) / 100,
          magazine_issue_id: issueFor(e.id, ym)!.id,
          advert_size_id: size.id,
        })),
      ),
    );
  };

  if (setup.editions.length === 0 || setup.sizes.length === 0) {
    return (
      <p className="mb-5 rounded-md border border-fp-pink/30 bg-fp-pink/5 px-4 py-3 text-sm">
        The Forget Me Not editions and advert sizes aren&apos;t set up yet (Magazines → Setup).
      </p>
    );
  }

  const lineCount = chosen.length * monthList.length;
  return (
    <section className="mb-5 rounded-lg border border-fp-pink/30 bg-fp-pink/5 p-4">
      <h3 className="mb-3 flex items-center gap-2 font-bold">
        <Newspaper size={16} aria-hidden className="text-fp-pink" /> Advert in Forget Me Not
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Ad size</span>
          <select value={sizeId} onChange={(e) => pickSize(e.target.value)} className={inputClass}>
            {setup.sizes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.width_mm && s.height_mm ? ` (${s.width_mm}×${s.height_mm}mm)` : ""}
              </option>
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
        <legend className="mb-1 flex flex-wrap items-center gap-3 font-semibold">
          Editions
          <button type="button" onClick={() => setEditions(setup.editions.map((e) => e.id))} className="text-xs font-semibold text-fp-teal-deep hover:underline">
            All
          </button>
          <button type="button" onClick={() => setEditions([])} className="text-xs font-semibold text-fp-teal-deep hover:underline">
            None
          </button>
        </legend>
        <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {setup.editions.map((e) => (
            <label key={e.id} className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={editions.includes(e.id)}
                onChange={(ev) => setEditions((list) => (ev.target.checked ? [...list, e.id] : list.filter((x) => x !== e.id)))}
                className="accent-fp-pink"
              />
              {e.code}. {e.name}
            </label>
          ))}
        </div>
      </fieldset>
      {missing.length > 0 && (
        <p className="mt-3 text-sm text-fp-error">
          No issue set up yet for {missing.slice(0, 3).join(", ")}
          {missing.length > 3 ? ` and ${missing.length - 3} more` : ""}. Add the months in Magazines → Setup.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={add} disabled={!ready} className={`${secondaryButton} disabled:cursor-not-allowed disabled:opacity-50`}>
          Add {lineCount || ""} advert line{lineCount === 1 ? "" : "s"} to the quote
        </button>
        <span className="text-xs text-fp-mid">
          {ready
            ? `${months} month${months === 1 ? "" : "s"} × ${chosen.length} edition${chosen.length === 1 ? "" : "s"} at £${Number(price).toFixed(2)} = £${(lineCount * Number(price)).toFixed(2)} before VAT`
            : "Choose at least one edition and a price."}
        </span>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";
import type { TermsPreset } from "@/lib/sales/terms-presets";

// The Terms box with a "Use preset…" list (DJ, 9 November 2026): picking a
// preset fills the box (asking first if it would replace edited terms); the
// words can still be changed for this customer.
export default function TermsField({ presets, defaultValue, rows }: { presets: TermsPreset[]; defaultValue: string | null; rows: number }) {
  const [terms, setTerms] = useState(defaultValue ?? "");
  const [picked, setPicked] = useState("");
  const use = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    if (terms.trim() && terms.trim() !== p.body.trim() && !window.confirm(`Replace the terms in the box with "${p.name}"?`)) {
      setPicked("");
      return;
    }
    setTerms(p.body);
    setPicked(id);
  };
  return (
    <div className="grid gap-2">
      {presets.length > 0 && (
        <select value={picked} onChange={(e) => use(e.target.value)} aria-label="Use a terms preset" className={`${inputClass} py-1 text-xs`}>
          <option value="">Use preset…</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <textarea name="terms" rows={rows} value={terms} onChange={(e) => setTerms(e.target.value)} className={inputClass} />
    </div>
  );
}

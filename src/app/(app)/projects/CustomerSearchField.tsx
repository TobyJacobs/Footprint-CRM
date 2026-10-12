"use client";

import { useRef, useState } from "react";
import { inputClass } from "@/components/ui";

type Hit = { id: string; name: string; billing_city: string | null };

// Pick a customer by typing part of the name. The chosen customer's id goes
// into a hidden field called customer_id. Leave it empty for an internal project.
export default function CustomerSearchField({ initial }: { initial: { id: string; name: string } | null }) {
  const [text, setText] = useState(initial?.name ?? "");
  const [id, setId] = useState(initial?.id ?? "");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    setText(q);
    setId("");
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits(null);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/customers?q=${encodeURIComponent(q.trim())}`);
        setHits(res.ok ? ((await res.json()) as Hit[]) : []);
      } catch {
        setHits([]);
      }
    }, 250);
  };

  return (
    <div className="relative">
      <input type="hidden" name="customer_id" value={id} />
      <input
        value={text}
        onChange={(e) => search(e.target.value)}
        placeholder="Start typing a customer name (leave empty for an internal project)"
        className={inputClass}
        autoComplete="off"
      />
      {text && id && (
        <button
          type="button"
          className="absolute right-2 top-2 text-xs font-semibold text-fp-dark/60 hover:text-fp-black"
          onClick={() => {
            setText("");
            setId("");
            setHits(null);
          }}
        >
          Clear
        </button>
      )}
      {hits !== null && !id && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-fp-border bg-white shadow-lg">
          {hits.length === 0 && <li className="px-3 py-2 text-sm text-fp-dark/70">No customers match.</li>}
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-fp-light"
                onClick={() => {
                  setText(h.name);
                  setId(h.id);
                  setHits(null);
                }}
              >
                <span className="font-semibold">{h.name}</span>
                {h.billing_city && <span className="text-fp-mid"> · {h.billing_city}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

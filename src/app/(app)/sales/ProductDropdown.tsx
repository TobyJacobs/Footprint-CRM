"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import type { ProductHit } from "./DocumentEditor";

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

// Every product for sale, loaded once per page and shared by all lines.
let cache: Promise<ProductHit[]> | null = null;
export function loadProducts(): Promise<ProductHit[]> {
  if (!cache) {
    cache = fetch("/api/search/products?all=1")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => {
        cache = null;
        return [];
      });
  }
  return cache;
}

// The text that goes on the quote line: product number first (Xero matches
// items by it), then the name, then the product's own description if any.
// The line text for a chosen product. Customer documents (quotes, orders,
// invoices) show just the name; purchase orders also start with the product
// number. The number is always saved on the line itself (product_code) for Xero.
export function productLineText(p: ProductHit, { withNumber = false }: { withNumber?: boolean } = {}) {
  const title = withNumber ? [p.sku, p.name].filter(Boolean).join(" – ") : p.name;
  return p.description && p.description.trim() !== p.name.trim() ? `${title}\n${p.description}` : title;
}

// Searchable dropdown of products for a quote / order / invoice line.
// Shows product names; type to narrow by name or product number.
export default function ProductDropdown({
  selectedId,
  onPick,
}: {
  selectedId: string | null;
  onPick: (p: ProductHit) => void;
}) {
  const [products, setProducts] = useState<ProductHit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  // Where the list floats (DJ, 9 November 2026: it was cut off by the lines
  // table, showing about one product). It's drawn over the page next to the
  // box, opening upwards when there isn't room below.
  const [place, setPlace] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  // Load the list when the page opens (so a saved line shows its product name).
  useEffect(() => {
    let alive = true;
    loadProducts().then((list) => alive && setProducts(list));
    return () => {
      alive = false;
    };
  }, []);

  // Close when clicking elsewhere.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Keep the floating list next to the box while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - Math.min(352, window.innerWidth * 0.85) - 8));
      setPlace(
        below >= 260 || below >= above
          ? { left, top: r.bottom + 4, maxHeight: Math.min(420, below) }
          : { left, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(420, above) },
      );
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  const matches = useMemo(() => {
    const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
    return (products ?? []).filter((p) => {
      const hay = `${p.name} ${p.sku ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [products, filter]);

  const selected = (products ?? []).find((p) => p.id === selectedId) ?? null;

  const choose = (p: ProductHit) => {
    onPick(p);
    setOpen(false);
    setFilter("");
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setActive(0);
          setTimeout(() => searchBox.current?.focus(), 0);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-fp-border bg-white px-2 py-1.5 text-left text-xs hover:border-fp-mid"
      >
        <span className={`truncate ${selected ? "font-semibold" : "text-fp-mid"}`}>
          {selected ? selected.name : selectedId ? "Product (no longer for sale)" : "Choose a product…"}
        </span>
        <ChevronDown size={14} className="shrink-0 text-fp-mid" aria-hidden />
      </button>

      {open && place && createPortal(
        <div
          ref={panel}
          style={{ position: "fixed", left: place.left, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
          className="z-50 flex w-[22rem] max-w-[85vw] flex-col rounded-md border border-fp-border bg-white shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-fp-border px-2">
            <Search size={14} className="text-fp-mid" aria-hidden />
            <input
              ref={searchBox}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, matches.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  // Never submit the whole quote from here.
                  e.preventDefault();
                  if (matches[active]) choose(matches[active]);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder="Type a product name or number…"
              className="w-full py-2 text-sm outline-none"
              autoComplete="off"
            />
          </div>
          <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1 text-sm">
            {products === null && <li className="px-3 py-2 text-fp-mid">Loading products…</li>}
            {products !== null && matches.length === 0 && (
              <li className="px-3 py-2 text-fp-mid">No products match. You can still type the line yourself.</li>
            )}
            {matches.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(p)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left ${
                    i === active ? "bg-fp-light" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="font-semibold">{p.name}</span>
                    {p.sku && <span className="ml-2 text-xs text-fp-mid">{p.sku}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-fp-dark/70">{money.format(p.sale_price)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}

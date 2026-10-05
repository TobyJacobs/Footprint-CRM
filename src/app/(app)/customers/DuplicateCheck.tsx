"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

export type PossibleDuplicate = {
  id: string;
  name: string;
  billing_city: string | null;
  billing_postcode: string | null;
  phone: string | null;
  email: string | null;
  reasons: string[];
};

// Looks up existing customers that might be the same company while a new one
// is being typed. Shows a "possible duplicates" warning; clicking it opens a
// box listing them. Choosing one calls `onSelect`, or by default leaves this
// page and opens that customer.
export function DuplicateCheck({
  name,
  phone,
  email,
  onSelect,
  selectLabel = "Open this customer",
}: {
  name: string;
  phone?: string;
  email?: string;
  onSelect?: (c: PossibleDuplicate) => void;
  selectLabel?: string;
}) {
  const router = useRouter();
  const [matches, setMatches] = useState<PossibleDuplicate[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = `${name.trim().toLowerCase()}|${(phone ?? "").trim()}|${(email ?? "").trim().toLowerCase()}`;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const n = name.trim();
    if (n.length < 3 && !phone?.trim() && !email?.trim()) {
      timer.current = setTimeout(() => setMatches([]), 0);
      return;
    }
    timer.current = setTimeout(async () => {
      const params = new URLSearchParams({ name: n, phone: phone?.trim() ?? "", email: email?.trim() ?? "" });
      const res = await fetch(`/api/customers/possible-duplicates?${params}`);
      setMatches(res.ok ? await res.json() : []);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [name, phone, email]);

  if (matches.length === 0) return null;

  const pick = (c: PossibleDuplicate) => {
    setOpen(false);
    if (onSelect) onSelect(c);
    else router.push(`/customers/${c.id}`);
  };
  const strong = matches.some((m) => m.reasons.some((r) => r !== "similar name"));

  return (
    <>
      {dismissed !== key && (
        <button
          key={matches.length}
          type="button"
          onClick={() => setOpen(true)}
          // Flashes a few times when it appears, to catch the eye.
          className={`mt-2 flex w-full animate-[pulse_0.6s_ease-in-out_3] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-semibold ${
            strong ? "border-fp-error/40 bg-fp-error/5 text-fp-error" : "border-fp-amber bg-fp-amber/10 text-fp-dark"
          }`}
        >
          <AlertTriangle size={16} className="shrink-0" aria-hidden />
          <span>
            {matches.length === 1 ? "1 possible duplicate" : `${matches.length} possible duplicates`}: click to check
            before creating a new customer
          </span>
        </button>
      )}

      {open &&
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dup-title"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-fp-border p-4">
              <div>
                <h2 id="dup-title" className="text-lg font-black">
                  Is it one of these?
                </h2>
                <p className="text-sm text-fp-dark/75">
                  These customers already exist and might be the same company. Choose one to use it instead of creating
                  a duplicate.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-fp-mid hover:bg-fp-light" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <ul className="max-h-[60vh] divide-y divide-fp-border overflow-y-auto">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-fp-light"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{c.name}</span>
                      <span className="block truncate text-xs text-fp-dark/70">
                        {[c.billing_city, c.billing_postcode, c.phone, c.email].filter(Boolean).join(" · ") || "No address or contact details"}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {c.reasons.map((r) => (
                          <span
                            key={r}
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              r === "similar name" ? "bg-fp-amber/20" : "bg-fp-error/10 text-fp-error"
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-xs font-semibold text-fp-teal-deep">{selectLabel} →</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end border-t border-fp-border p-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setDismissed(key);
                }}
                className="rounded-md px-3 py-2 text-sm font-semibold text-fp-dark/75 hover:bg-fp-light"
              >
                None of these: carry on creating a new customer
              </button>
            </div>
          </div>
        </div>,
          // Rendered at page level so it isn't inside the form field's label.
          document.body,
        )}
    </>
  );
}

// For the "New customer" page: watches the form's Name, Phone and Email boxes
// and shows the duplicate check under the name.
export function NewCustomerDuplicateWatcher() {
  const anchor = useRef<HTMLSpanElement>(null);
  const [values, setValues] = useState({ name: "", phone: "", email: "" });

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const read = () => {
      const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
      setValues({ name: get("name"), phone: get("phone"), email: get("email") });
    };
    form.addEventListener("input", read);
    return () => form.removeEventListener("input", read);
  }, []);

  return (
    <span ref={anchor} className="block">
      <DuplicateCheck name={values.name} phone={values.phone} email={values.email} />
    </span>
  );
}

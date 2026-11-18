"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/components/ui";
import { quoteKinds, type QuoteKind } from "@/lib/sales/options";

// "What kind of quote?" at the top of a new quote. Changing it reloads the
// screen for that kind (standard lines, the advert builder or the proposal
// sections), keeping the customer and contact already picked.
export default function QuoteKindPicker({ kind, formId }: { kind: QuoteKind; formId: string }) {
  const router = useRouter();
  const touched = useRef(false);

  // Remember once anything has been typed, so switching can warn first.
  useEffect(() => {
    const form = document.getElementById(formId);
    const mark = () => (touched.current = true);
    form?.addEventListener("input", mark);
    return () => form?.removeEventListener("input", mark);
  }, [formId]);

  return (
    <label className="mb-6 grid max-w-sm gap-1 text-sm">
      <span className="font-semibold">What kind of quote?</span>
      <select
        value={kind}
        className={inputClass}
        onChange={(e) => {
          const next = e.target.value;
          if (touched.current && !window.confirm("Switch to a different kind? The lines and notes you've typed will be cleared.")) {
            e.target.value = kind;
            return;
          }
          const form = document.getElementById(formId) as HTMLFormElement | null;
          const params = new URLSearchParams({ type: "quote", kind: next });
          const customer = (form?.elements.namedItem("customer_id") as HTMLInputElement | null)?.value;
          const contact = (form?.elements.namedItem("contact_id") as HTMLSelectElement | null)?.value;
          if (customer) params.set("customer", customer);
          if (customer && contact) params.set("contact", contact);
          router.replace(`/sales/new?${params.toString()}`);
        }}
      >
        {quoteKinds.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-fp-mid">{quoteKinds.find((k) => k.value === kind)?.description}</span>
    </label>
  );
}

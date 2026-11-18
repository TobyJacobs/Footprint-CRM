"use client";

import type { ReactNode } from "react";
import { dueTermsForCreditStatus } from "@/lib/customers/options";

// Picking a credit status fills in when invoices are due (DJ, 11 November
// 2026): Net 30 → 30 day(s) after bill date; Upfront payment → 0. Staff can
// still change the boxes afterwards.
export default function CreditTermsAutofill({ children }: { children: ReactNode }) {
  return (
    <div
      className="contents"
      onChange={(e) => {
        const el = e.target as unknown as HTMLSelectElement;
        if (el.name !== "credit_status" || !el.form) return;
        const t = dueTermsForCreditStatus(el.value);
        if (!t) return;
        const days = el.form.elements.namedItem("invoice_due_days") as HTMLInputElement | null;
        const terms = el.form.elements.namedItem("invoice_due_terms") as HTMLSelectElement | null;
        if (days) days.value = String(t.days);
        if (terms) terms.value = t.terms;
      }}
    >
      {children}
    </div>
  );
}

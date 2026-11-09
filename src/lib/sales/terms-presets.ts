// Terms presets (DJ, 9 November 2026): named terms and conditions staff pick
// from on the Terms box. Each says which documents it's offered on.
export const termsTargets = [
  { value: "quote", label: "Quotes" },
  { value: "advertising", label: "Advertising quotes" },
  { value: "proposal", label: "Proposals" },
  { value: "sales_order", label: "Sales orders" },
  { value: "invoice", label: "Invoices" },
] as const;
export type TermsTarget = (typeof termsTargets)[number]["value"];
export const isTermsTarget = (v: unknown): v is TermsTarget => termsTargets.some((t) => t.value === v);

// Which presets a form offers: quotes by their kind, other documents by type.
export const termsTargetFor = (docType: string, quoteKind: string | null | undefined): TermsTarget | null =>
  docType === "quote" ? (quoteKind === "advertising" || quoteKind === "proposal" ? quoteKind : "quote") : isTermsTarget(docType) ? docType : null;

export type TermsPreset = { id: string; name: string; body: string; applies_to: string[] };

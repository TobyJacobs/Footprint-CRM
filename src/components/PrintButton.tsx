"use client";

import { Printer } from "lucide-react";

// Opens the browser's print dialog — choose "Save as PDF" to make a PDF.
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md bg-fp-pink px-4 py-2 text-sm font-semibold text-white hover:bg-fp-pink/90"
    >
      <Printer size={14} aria-hidden /> Print or save as PDF
    </button>
  );
}

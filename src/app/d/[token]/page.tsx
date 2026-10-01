import type { Metadata } from "next";
import PrintButton from "@/components/PrintButton";
import PrintableDocument, { type PrintableData } from "@/components/PrintableDocument";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your document", robots: { index: false, follow: false } };

type PublicDoc = {
  doc_type: "invoice" | "credit_note" | "sales_order";
  number: string;
  title: string | null;
  status: string;
  issue_date: string;
  due_date: string | null;
  customer_reference: string | null;
  credit_reason: string | null;
  notes: string | null;
  terms: string | null;
  subtotal: number;
  vat_total: number;
  total: number;
  customer_name: string;
  customer_address: string | null;
  contact_name: string | null;
  lines: PrintableData["lines"];
  company: (PrintableData["company"] & { bank_details?: string | null }) | null;
};

const labels = { invoice: "Invoice", credit_note: "Credit note", sales_order: "Order confirmation" };

// Read-only page a customer sees from the link in an emailed invoice,
// credit note or order. No sign-in; only works with the private link.
export default async function PublicDocumentPage(props: PageProps<"/d/[token]">) {
  const { token } = await props.params;
  let doc: PublicDoc | null = null;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_public_document", { p_token: token });
    doc = (data as PublicDoc | null) ?? null;
  }

  return (
    <div className="min-h-screen bg-fp-offwhite print:bg-white">
      <div className="bg-fp-gradient h-1 print:hidden" />
      <main className="mx-auto max-w-4xl px-4 py-8 print:p-0">
        {!doc ? (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-black">Document not found</h1>
            <p className="mt-2 text-fp-dark/75">This link isn&apos;t valid. Please check it, or contact us and we&apos;ll send a new one.</p>
          </div>
        ) : (
          <>
            {doc.status === "void" && (
              <p className="mb-4 rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-sm text-fp-error print:hidden">
                This {labels[doc.doc_type].toLowerCase()} has been cancelled (void).
              </p>
            )}
            {doc.doc_type === "invoice" && doc.status === "paid" && (
              <p className="mb-4 rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep print:hidden">
                Paid — thank you.
              </p>
            )}
            <div className="mb-4 flex justify-end print:hidden">
              <PrintButton />
            </div>
            <PrintableDocument
              d={{
                label: labels[doc.doc_type],
                number: doc.number,
                title: doc.title,
                issue_date: doc.issue_date,
                due_date: doc.doc_type === "invoice" ? doc.due_date : null,
                customer_reference: doc.customer_reference,
                reason: doc.doc_type === "credit_note" ? doc.credit_reason : null,
                customer: { name: doc.customer_name, address: doc.customer_address, contact: doc.contact_name },
                lines: doc.lines,
                subtotal: Number(doc.subtotal),
                vat_total: Number(doc.vat_total),
                total: Number(doc.total),
                notes: doc.notes,
                terms: doc.terms,
                bank_details: doc.company?.bank_details ?? null,
                company: doc.company,
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}

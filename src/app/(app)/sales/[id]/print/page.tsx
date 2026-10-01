import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import PrintableDocument, { customerAddress } from "@/components/PrintableDocument";
import { requirePermission } from "@/lib/auth";
import { personName } from "@/lib/customers/display";
import { getCompanySettings, getDocumentLines } from "@/lib/sales/data";
import { docTypes, isDocType, type DocType } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Print" };

export default async function PrintDocumentPage(props: PageProps<"/sales/[id]/print">) {
  await requirePermission("quotes", "view");
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("sales_documents")
    .select("*, customers!sales_documents_customer_id_fkey(*), contacts(first_name, last_name)")
    .eq("id", id)
    .maybeSingle();
  if (!doc || !isDocType(doc.doc_type)) notFound();

  const [lines, company] = await Promise.all([getDocumentLines(id), getCompanySettings()]);
  const customer = doc.customers as Record<string, unknown>;
  const contact = doc.contacts as { first_name: string | null; last_name: string } | null;

  return (
    <>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/sales/${id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to {doc.number}
        </Link>
        <PrintButton />
      </div>
      <PrintableDocument
        d={{
          label: docTypes[doc.doc_type as DocType].label,
          number: doc.number,
          title: doc.title,
          issue_date: doc.issue_date,
          valid_until: doc.doc_type === "quote" ? doc.valid_until : null,
          due_date: doc.doc_type === "invoice" ? doc.due_date : null,
          customer_reference: doc.customer_reference,
          customer: { name: customer.name as string, address: customerAddress(customer), contact: contact ? personName(contact) : null },
          lines,
          subtotal: Number(doc.subtotal),
          vat_total: Number(doc.vat_total),
          total: Number(doc.total),
          notes: doc.notes,
          terms: doc.terms,
          bank_details: doc.doc_type === "invoice" ? company?.bank_details : null,
          reason: doc.doc_type === "credit_note" ? doc.credit_reason : null,
          company,
        }}
      />
    </>
  );
}

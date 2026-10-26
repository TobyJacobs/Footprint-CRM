import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { customerAddress, type PrintableData } from "@/components/PrintableDocument";
import { personName } from "@/lib/customers/display";
import { getCompanySettings, getDocumentLines } from "./data";
import { docTypes, isDocType, quoteKindLabel, type DocType } from "./options";

// Everything a quote, order, invoice or credit note shows the customer, in the
// shape the printable page and the PDF both use. Null if it can't be found.
export async function loadPrintableData(supabase: SupabaseClient, id: string): Promise<{ doc: Record<string, unknown>; data: PrintableData } | null> {
  const { data: doc } = await supabase
    .from("sales_documents")
    .select("*, customers!sales_documents_customer_id_fkey(*), contacts(first_name, last_name)")
    .eq("id", id)
    .maybeSingle();
  if (!doc || !isDocType(doc.doc_type)) return null;

  const [lines, company] = await Promise.all([getDocumentLines(id), getCompanySettings()]);
  const customer = doc.customers as Record<string, unknown>;
  const contact = doc.contacts as { first_name: string | null; last_name: string } | null;
  const type = doc.doc_type as DocType;
  // A proposal or advertising quote is labelled as such.
  const label = type === "quote" && doc.quote_kind && doc.quote_kind !== "quote" ? quoteKindLabel(doc.quote_kind) : docTypes[type].label;

  return {
    doc,
    data: {
      label,
      number: doc.number,
      title: doc.title,
      issue_date: doc.issue_date,
      valid_until: type === "quote" ? doc.valid_until : null,
      due_date: type === "invoice" ? doc.due_date : null,
      customer_reference: doc.customer_reference,
      // The document's own billing address if it has one (sales orders, and invoices made from them).
      customer: { name: customer.name as string, address: doc.billing_address || customerAddress(customer), contact: contact ? personName(contact) : null },
      deliver_to: type === "sales_order" ? doc.delivery_address : null,
      delivery_notes: type === "sales_order" ? doc.delivery_notes : null,
      lines,
      subtotal: Number(doc.subtotal),
      vat_total: Number(doc.vat_total),
      total: Number(doc.total),
      notes: doc.notes,
      terms: doc.terms,
      bank_details: type === "invoice" ? company?.bank_details : null,
      reason: type === "credit_note" ? doc.credit_reason : null,
      company,
    },
  };
}

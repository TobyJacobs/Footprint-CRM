import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ContractDocument, { type ContractData } from "@/components/ContractDocument";
import PrintButton from "@/components/PrintButton";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contract" };

// A proposal's contract (DJ, 16 November 2026): the signed copy once the
// customer has accepted online, otherwise the contract as it stands now. From
// a sales order, the contract of the proposal it came from. Print or save as
// PDF with the browser.
export default async function ContractPage(props: PageProps<"/sales/[id]/contract">) {
  await requirePermission("quotes", "view");
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("sales_documents")
    .select("id, number, doc_type, source_document_id, contract_enabled, contract_signed_at, contract_snapshot")
    .eq("id", id)
    .maybeSingle();
  if (!doc) notFound();

  // A sales order shows its proposal's contract.
  let quote = doc;
  if (doc.doc_type !== "quote" && doc.source_document_id) {
    const { data: src } = await supabase
      .from("sales_documents")
      .select("id, number, doc_type, source_document_id, contract_enabled, contract_signed_at, contract_snapshot")
      .eq("id", doc.source_document_id)
      .maybeSingle();
    if (src) quote = src;
  }
  if (!quote.contract_enabled && !quote.contract_signed_at) notFound();

  let contract: ContractData | null = null;
  if (quote.contract_signed_at && quote.contract_snapshot) {
    contract = { ...(quote.contract_snapshot as ContractData), signed: true };
  } else {
    const { data } = await supabase.rpc("contract_json", { p_id: quote.id });
    contract = data ? { ...(data as ContractData), signed: false } : null;
  }
  if (!contract) notFound();
  const { data: settings } = await supabase.from("company_settings").select("company_name").single();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/sales/${id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to {doc.number}
        </Link>
        <p className="text-sm text-fp-dark/75">
          {contract.signed ? "Signed copy: exactly what the customer signed." : "Not signed yet. The customer signs it by accepting the proposal online."}
        </p>
        <PrintButton />
      </div>
      <ContractDocument c={contract} companyName={settings?.company_name} />
    </>
  );
}

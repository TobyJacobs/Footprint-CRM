import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getStaffOptions } from "@/lib/customers/staff";
import { getCustomerWithContacts, getDocumentLines, getTaxRates } from "@/lib/sales/data";
import { docTypes, isDocType, type DocType } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";
import { saveDocument } from "../../actions";
import DocumentForm from "../../DocumentForm";

export const metadata: Metadata = { title: "Edit document" };

export default async function EditDocumentPage(props: PageProps<"/sales/[id]/edit">) {
  await requirePermission("quotes", "edit");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("sales_documents").select("*").eq("id", id).maybeSingle();
  if (!doc || !isDocType(doc.doc_type)) notFound();
  const type = doc.doc_type as DocType;

  const [taxRates, staff, lines, picked] = await Promise.all([
    getTaxRates(),
    getStaffOptions(),
    getDocumentLines(id),
    getCustomerWithContacts(doc.customer_id),
  ]);

  return (
    <>
      <Link href={`/sales/${id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Back to {doc.number}
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">
        Edit {docTypes[type].label.toLowerCase()} {doc.number}
      </h2>
      <Notice searchParams={sp} />
      <DocumentForm
        docType={type}
        doc={doc}
        lines={lines}
        customer={picked.customer}
        contacts={picked.contacts}
        taxRates={taxRates}
        staff={staff}
        defaults={{ issue_date: doc.issue_date }}
        action={saveDocument.bind(null, type, id)}
        cancelHref={`/sales/${id}`}
      />
    </>
  );
}

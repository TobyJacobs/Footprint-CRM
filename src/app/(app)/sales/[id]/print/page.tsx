import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import PrintableDocument from "@/components/PrintableDocument";
import { requirePermission } from "@/lib/auth";
import { loadPrintableData } from "@/lib/sales/print-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Print" };

export default async function PrintDocumentPage(props: PageProps<"/sales/[id]/print">) {
  await requirePermission("quotes", "view");
  const { id } = await props.params;
  const found = await loadPrintableData(await createClient(), id);
  if (!found) notFound();

  return (
    <>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/sales/${id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to {found.data.number}
        </Link>
        <PrintButton />
      </div>
      <PrintableDocument d={found.data} />
    </>
  );
}

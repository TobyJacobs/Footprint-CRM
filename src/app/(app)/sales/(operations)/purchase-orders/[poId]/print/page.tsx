import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import PrintableDocument from "@/components/PrintableDocument";
import { requirePermission } from "@/lib/auth";
import { getCompanySettings, getPurchaseOrderLines } from "@/lib/sales/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Print purchase order" };

export default async function PrintPurchaseOrderPage(props: PageProps<"/sales/purchase-orders/[poId]/print">) {
  await requirePermission("quotes", "view");
  const { poId } = await props.params;
  const supabase = await createClient();
  const { data: po } = await supabase.from("purchase_orders").select("*, suppliers(*)").eq("id", poId).maybeSingle();
  if (!po) notFound();
  const [lines, company] = await Promise.all([getPurchaseOrderLines(poId), getCompanySettings()]);
  const supplier = po.suppliers as unknown as { name: string; address: string | null; contact_name: string | null; account_reference: string | null };

  return (
    <>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/sales/purchase-orders/${poId}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to {po.number}
        </Link>
        <PrintButton />
      </div>
      <PrintableDocument
        d={{
          label: "Purchase order",
          forLabel: "Supplier",
          number: po.number,
          issue_date: po.issue_date,
          needed_by: po.expected_date,
          customer_reference: supplier.account_reference,
          customer: { name: supplier.name, address: supplier.address, contact: supplier.contact_name },
          deliver_to: po.deliver_to,
          lines: lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_cost,
            discount_percent: 0,
            tax_rate: l.tax_rate,
            line_net: l.line_net,
          })),
          subtotal: Number(po.subtotal),
          vat_total: Number(po.vat_total),
          total: Number(po.total),
          notes: po.notes,
          company,
        }}
      />
    </>
  );
}

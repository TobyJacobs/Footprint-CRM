import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getStaffOptions } from "@/lib/customers/staff";
import { getPurchaseOrderLines, getSuppliers, getTaxRates } from "@/lib/sales/data";
import { createClient } from "@/lib/supabase/server";
import { savePurchaseOrder } from "../../actions";
import PoForm from "../../PoForm";

export const metadata: Metadata = { title: "Edit purchase order" };

export default async function EditPurchaseOrderPage(props: PageProps<"/sales/purchase-orders/[poId]/edit">) {
  await requirePermission("quotes", "edit");
  const { poId } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: po } = await supabase.from("purchase_orders").select("*").eq("id", poId).maybeSingle();
  if (!po) notFound();
  const [suppliers, taxRates, staff, lines] = await Promise.all([
    getSuppliers(false),
    getTaxRates(),
    getStaffOptions(),
    getPurchaseOrderLines(poId),
  ]);
  return (
    <>
      <Link href={`/sales/purchase-orders/${poId}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Back to {po.number}
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">Edit purchase order {po.number}</h2>
      <Notice searchParams={sp} />
      <PoForm
        po={po}
        lines={lines}
        suppliers={suppliers}
        taxRates={taxRates}
        staff={staff}
        defaults={{ issue_date: po.issue_date }}
        action={savePurchaseOrder.bind(null, poId)}
        cancelHref={`/sales/purchase-orders/${poId}`}
      />
    </>
  );
}

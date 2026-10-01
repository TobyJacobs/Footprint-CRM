import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getStaffOptions } from "@/lib/customers/staff";
import { getSuppliers, getTaxRates } from "@/lib/sales/data";
import { savePurchaseOrder } from "../actions";
import PoForm from "../PoForm";

export const metadata: Metadata = { title: "New purchase order" };

export default async function NewPurchaseOrderPage(props: PageProps<"/sales/purchase-orders/new">) {
  const user = await requirePermission("quotes", "edit");
  const sp = await props.searchParams;
  const [suppliers, taxRates, staff] = await Promise.all([getSuppliers(), getTaxRates(), getStaffOptions()]);
  return (
    <>
      <Link href="/sales/purchase-orders" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Purchase orders
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">New purchase order</h2>
      <Notice searchParams={sp} />
      <PoForm
        lines={[]}
        suppliers={suppliers}
        taxRates={taxRates}
        staff={staff}
        defaults={{
          issue_date: new Date().toISOString().slice(0, 10),
          owner_id: user.id,
          supplier_id: typeof sp.supplier === "string" ? sp.supplier : null,
        }}
        action={savePurchaseOrder.bind(null, null)}
        cancelHref="/sales/purchase-orders"
      />
    </>
  );
}

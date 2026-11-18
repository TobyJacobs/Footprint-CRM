import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { saveSupplier } from "../../purchase-orders/actions";
import SupplierForm from "../SupplierForm";

export const metadata: Metadata = { title: "New supplier" };

export default async function NewSupplierPage(props: PageProps<"/sales/suppliers/new">) {
  await requirePermission("quotes", "edit");
  const sp = await props.searchParams;
  return (
    <>
      <Link href="/sales/suppliers" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Suppliers
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">New supplier</h2>
      <Notice searchParams={sp} />
      <SupplierForm action={saveSupplier.bind(null, null)} />
    </>
  );
}

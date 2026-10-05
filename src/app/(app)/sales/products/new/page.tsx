import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getSalesAccounts, getTaxRates } from "@/lib/sales/data";
import { createClient } from "@/lib/supabase/server";
import { saveProduct } from "../../actions";
import ProductForm from "../ProductForm";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage(props: PageProps<"/sales/products/new">) {
  await requirePermission("quotes", "edit");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: suppliers }, taxRates, salesAccounts] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
    getTaxRates(),
    getSalesAccounts(),
  ]);
  return (
    <>
      <Link href="/sales/products" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Products
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">New product</h2>
      <Notice searchParams={sp} />
      <ProductForm suppliers={suppliers ?? []} taxRates={taxRates}
        salesAccounts={salesAccounts} action={saveProduct.bind(null, null)} />
    </>
  );
}

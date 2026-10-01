import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getTaxRates } from "@/lib/sales/data";
import { createClient } from "@/lib/supabase/server";
import { saveProduct } from "../../actions";
import ProductForm from "../ProductForm";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage(props: PageProps<"/sales/products/[productId]">) {
  await requirePermission("quotes", "edit");
  const { productId } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: product }, { data: suppliers }, taxRates] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).maybeSingle(),
    supabase.from("suppliers").select("id, name").order("name"),
    getTaxRates(),
  ]);
  if (!product) notFound();
  return (
    <>
      <Link href="/sales/products" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Products
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">{product.name}</h2>
      <Notice searchParams={sp} />
      <ProductForm
        product={product}
        suppliers={suppliers ?? []}
        taxRates={taxRates}
        action={saveProduct.bind(null, productId)}
      />
    </>
  );
}

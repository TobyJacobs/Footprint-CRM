import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { gbp } from "@/lib/customers/display";
import { marginPercent } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage(props: PageProps<"/sales/products">) {
  const user = await requirePermission("quotes", "view");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("id, name, sku, unit, sale_price, cost_price, active, suppliers(name), tax_rates(name)")
    .order("name")
    .limit(200);
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    query = query.or(`name.ilike.${like},sku.ilike.${like}`);
  }
  const { data: products } = await query;

  return (
    <>
      <Notice searchParams={sp} />
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <form action="/sales/products" className="flex flex-1 flex-wrap items-end gap-3">
          <label className="grid min-w-[220px] flex-1 gap-1 text-sm">
            <span className="font-semibold">Search</span>
            <input name="q" defaultValue={q} placeholder="Product name or code" className={inputClass} />
          </label>
          <button type="submit" className={secondaryButton}>
            Search
          </button>
        </form>
        {user.can("quotes", "edit") && (
          <Link href="/sales/products/new" className={`${primaryButton} inline-flex items-center gap-2`}>
            <Plus size={16} aria-hidden /> New product
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-fp-border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-fp-border bg-fp-offwhite text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 text-right font-semibold">Price</th>
              <th className="px-4 py-3 text-right font-semibold">Cost</th>
              <th className="px-4 py-3 text-right font-semibold">Margin</th>
              <th className="px-4 py-3 font-semibold">VAT</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => {
              const m = p.cost_price === null ? null : marginPercent(Number(p.sale_price), Number(p.cost_price));
              return (
                <tr key={p.id} className="border-b border-fp-border last:border-0 hover:bg-fp-offwhite">
                  <td className="px-4 py-3">
                    <Link href={`/sales/products/${p.id}`} className="font-semibold hover:text-fp-pink">
                      {p.name}
                    </Link>
                    {!p.active && <span className="ml-2"><Badge>Not for sale</Badge></span>}
                    {p.sku && <div className="text-xs text-fp-mid">{p.sku}</div>}
                  </td>
                  <td className="px-4 py-3">{(p.suppliers as unknown as { name: string } | null)?.name}</td>
                  <td className="px-4 py-3 text-right">
                    {gbp(Number(p.sale_price))}
                    {p.unit && <span className="text-xs text-fp-mid"> / {p.unit}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{p.cost_price === null ? "—" : gbp(Number(p.cost_price))}</td>
                  <td className="px-4 py-3 text-right">{m === null ? "—" : `${m}%`}</td>
                  <td className="px-4 py-3">{(p.tax_rates as unknown as { name: string } | null)?.name}</td>
                </tr>
              );
            })}
            {(products ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-fp-mid">
                  {q ? "No products match." : "No products yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

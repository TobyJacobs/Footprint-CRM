import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Notice, primaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage(props: PageProps<"/sales/suppliers">) {
  const user = await requirePermission("quotes", "view");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: suppliers }, { data: products }, { data: pos }] = await Promise.all([
    supabase.from("suppliers").select("id, name, contact_name, email, phone, active").order("name"),
    supabase.from("products").select("supplier_id"),
    supabase.from("purchase_orders").select("supplier_id").in("status", ["draft", "sent"]),
  ]);
  const count = (rows: { supplier_id: string | null }[] | null, id: string) => (rows ?? []).filter((r) => r.supplier_id === id).length;

  return (
    <>
      <Notice searchParams={sp} />
      <div className="mb-6 flex justify-end">
        {user.can("quotes", "edit") && (
          <Link href="/sales/suppliers/new" className={`${primaryButton} inline-flex items-center gap-2`}>
            <Plus size={16} aria-hidden /> New supplier
          </Link>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-fp-border bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-fp-border bg-fp-offwhite text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 text-right font-semibold">Products</th>
              <th className="px-4 py-3 text-right font-semibold">Open POs</th>
            </tr>
          </thead>
          <tbody>
            {(suppliers ?? []).map((s) => (
              <tr key={s.id} className="border-b border-fp-border last:border-0 hover:bg-fp-offwhite">
                <td className="px-4 py-3">
                  <Link href={`/sales/suppliers/${s.id}`} className="font-semibold hover:text-fp-pink">
                    {s.name}
                  </Link>
                  {!s.active && <span className="ml-2"><Badge>Inactive</Badge></span>}
                </td>
                <td className="px-4 py-3">{[s.contact_name, s.email, s.phone].filter(Boolean).join(" · ") || <span className="text-fp-mid">—</span>}</td>
                <td className="px-4 py-3 text-right">{count(products, s.id)}</td>
                <td className="px-4 py-3 text-right">{count(pos, s.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

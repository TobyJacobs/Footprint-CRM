import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { gbp } from "@/lib/customers/display";
import { getSuppliers } from "@/lib/sales/data";
import { createClient } from "@/lib/supabase/server";
import { raisePurchaseOrders } from "../actions";

export const metadata: Metadata = { title: "Raise purchase orders" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Raise purchase orders from a sales order (DJ, 11 November 2026): pick the
// supplier for each line (each can be different), starting from the product's
// supplier. Saving makes one draft PO per supplier with just their lines.
export default async function RaisePurchaseOrdersPage(props: PageProps<"/sales/purchase-orders/raise">) {
  await requirePermission("quotes", "edit");
  const sp = await props.searchParams;
  const orderId = typeof sp.order === "string" && UUID_RE.test(sp.order) ? sp.order : null;
  if (!orderId) notFound();
  const supabase = await createClient();
  const [{ data: so }, { data: lines }, suppliers] = await Promise.all([
    supabase
      .from("sales_documents")
      .select("id, number, doc_type, status, customers!sales_documents_customer_id_fkey(name)")
      .eq("id", orderId)
      .maybeSingle(),
    supabase
      .from("sales_document_lines")
      .select("id, description, quantity, unit_cost, position, products(name, supplier_id)")
      .eq("document_id", orderId)
      .order("position"),
    getSuppliers(),
  ]);
  if (!so || so.doc_type !== "sales_order") notFound();
  const customer = (so.customers as unknown as { name: string } | null)?.name;

  return (
    <>
      <Link href={`/sales/${so.id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Sales order {so.number}
      </Link>
      <h2 className="mb-2 mt-3 text-xl font-black">Raise purchase orders</h2>
      <p className="mb-6 max-w-3xl text-sm text-fp-dark/75">
        Pick who supplies each line{customer ? ` for ${customer}` : ""}. Each line can come from a different supplier. You&apos;ll get one draft purchase
        order per supplier with just their lines, ready to email or mark as ordered.
      </p>
      <Notice searchParams={sp} />
      <form action={raisePurchaseOrders.bind(null, so.id)}>
        <Card title="Lines">
          {(lines ?? []).length === 0 ? (
            <p className="text-sm text-fp-mid">This order has no lines.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Item</th>
                    <th className="py-2 pr-3 text-right font-semibold">Qty</th>
                    <th className="py-2 pr-3 text-right font-semibold">Our cost</th>
                    <th className="py-2 font-semibold">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {(lines ?? []).map((l) => {
                    const product = l.products as unknown as { name: string; supplier_id: string | null } | null;
                    const title = l.description.split("\n")[0] || product?.name || "Line";
                    return (
                      <tr key={l.id} className="border-b border-fp-border align-top last:border-0">
                        <td className="py-2 pr-3">{title}</td>
                        <td className="py-2 pr-3 text-right">{Number(l.quantity)}</td>
                        <td className="py-2 pr-3 text-right">{l.unit_cost === null ? "—" : gbp(Number(l.unit_cost))}</td>
                        <td className="py-2">
                          <select
                            name={`supplier:${l.id}`}
                            defaultValue={product?.supplier_id ?? ""}
                            aria-label={`Supplier for ${title}`}
                            className={inputClass}
                          >
                            <option value="">Not needed</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryButton}>
            Create purchase orders
          </button>
          <Link href={`/sales/${so.id}`} className={secondaryButton}>
            Cancel
          </Link>
          <Link href="/sales/suppliers" className="text-sm font-semibold text-fp-teal-deep hover:underline">
            Supplier missing? Add it in Suppliers
          </Link>
        </div>
      </form>
    </>
  );
}

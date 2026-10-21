import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge, Card, Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { gbp, longDate } from "@/lib/customers/display";
import { poStatusLabel, statusToneFor } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";
import { saveSupplier } from "../../purchase-orders/actions";
import SupplierForm from "../SupplierForm";

export const metadata: Metadata = { title: "Supplier" };

export default async function SupplierPage(props: PageProps<"/sales/suppliers/[supplierId]">) {
  const user = await requirePermission("quotes", "view");
  const { supplierId } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: supplier }, { data: pos }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", supplierId).maybeSingle(),
    supabase
      .from("purchase_orders")
      .select("id, number, status, issue_date, total")
      .eq("supplier_id", supplierId)
      .order("issue_date", { ascending: false })
      .limit(20),
  ]);
  if (!supplier) notFound();

  return (
    <>
      <Link href="/sales/suppliers" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Suppliers
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">{supplier.name}</h2>
      <Notice searchParams={sp} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {user.can("quotes", "edit") ? (
          <SupplierForm supplier={supplier} action={saveSupplier.bind(null, supplierId)} />
        ) : (
          <Card title="Supplier">
            <p className="whitespace-pre-line text-sm">
              {[supplier.contact_name, supplier.email, supplier.phone, supplier.address].filter(Boolean).join("\n")}
            </p>
          </Card>
        )}
        <Card
          title="Recent purchase orders"
          action={
            user.can("quotes", "edit") && (
              <Link
                href={`/sales/purchase-orders/new?supplier=${supplierId}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline"
              >
                <Plus size={14} aria-hidden /> New PO
              </Link>
            )
          }
        >
          {(pos ?? []).length === 0 ? (
            <p className="text-sm text-fp-mid">None yet.</p>
          ) : (
            <ul className="divide-y divide-fp-border text-sm">
              {(pos ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/sales/purchase-orders/${p.id}`} className="font-semibold hover:text-fp-pink">
                    {p.number}
                  </Link>
                  <span className="text-fp-mid">{longDate(p.issue_date)}</span>
                  <Badge tone={statusToneFor(p.status)}>{poStatusLabel(p.status)}</Badge>
                  <span className="font-semibold">{gbp(Number(p.total))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

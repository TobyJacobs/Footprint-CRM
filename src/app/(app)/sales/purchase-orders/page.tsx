import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { gbp, longDate } from "@/lib/customers/display";
import { poStatusLabel, poStatuses, statusToneFor } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Purchase orders" };

const PAGE_SIZE = 50;

export default async function PurchaseOrdersPage(props: PageProps<"/sales/purchase-orders">) {
  const user = await requirePermission("quotes", "view");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const forDoc = typeof sp.for === "string" && /^[0-9a-f-]{36}$/i.test(sp.for) ? sp.for : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("purchase_orders")
    .select("id, number, status, issue_date, expected_date, total, suppliers(name), sales_documents(number)", { count: "exact" })
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (forDoc) query = query.eq("sales_document_id", forDoc);
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    const { data: sups } = await supabase.from("suppliers").select("id").ilike("name", like);
    const parts = [`number.ilike.${like}`, `supplier_reference.ilike.${like}`];
    if (sups?.length) parts.push(`supplier_id.in.(${sups.map((s) => s.id).join(",")})`);
    query = query.or(parts.join(","));
  }
  const { data: pos, count } = await query;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/sales/purchase-orders${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <Notice searchParams={sp} />
      {forDoc && (
        <p className="mb-4 text-sm text-fp-dark/75">
          Showing the purchase orders raised for one sales order.{" "}
          <Link href="/sales/purchase-orders" className="font-semibold text-fp-teal-deep hover:underline">
            Show all
          </Link>
        </p>
      )}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <form action="/sales/purchase-orders" className="flex flex-1 flex-wrap items-end gap-3">
          <label className="grid min-w-[220px] flex-1 gap-1 text-sm">
            <span className="font-semibold">Search</span>
            <input name="q" defaultValue={q} placeholder="PO number, supplier or their reference" className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Status</span>
            <select name="status" defaultValue={status} className={inputClass}>
              <option value="">Any</option>
              {poStatuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={secondaryButton}>
            Search
          </button>
        </form>
        {user.can("quotes", "edit") && (
          <Link href="/sales/purchase-orders/new" className={`${primaryButton} inline-flex items-center gap-2`}>
            <Plus size={16} aria-hidden /> New purchase order
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-fp-border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-fp-border bg-fp-offwhite text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="px-4 py-3 font-semibold">Number</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold">For order</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {(pos ?? []).map((p) => (
              <tr key={p.id} className="border-b border-fp-border last:border-0 hover:bg-fp-offwhite">
                <td className="px-4 py-3">
                  <Link href={`/sales/purchase-orders/${p.id}`} className="font-semibold hover:text-fp-pink">
                    {p.number}
                  </Link>
                </td>
                <td className="px-4 py-3">{(p.suppliers as unknown as { name: string } | null)?.name}</td>
                <td className="px-4 py-3">{(p.sales_documents as unknown as { number: string } | null)?.number ?? "—"}</td>
                <td className="px-4 py-3">{longDate(p.issue_date)}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusToneFor(p.status)}>{poStatusLabel(p.status)}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{gbp(Number(p.total))}</td>
              </tr>
            ))}
            {(pos ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-fp-mid">
                  No purchase orders{q || status ? " match those filters" : " yet"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-fp-dark/75">
        <span>
          {total.toLocaleString("en-GB")} purchase order{total === 1 ? "" : "s"}
        </span>
        {pages > 1 && (
          <span className="flex items-center gap-3">
            {page > 1 && (
              <Link href={link(page - 1)} className="font-semibold text-fp-teal-deep hover:underline">
                ← Previous
              </Link>
            )}
            Page {page} of {pages}
            {page < pages && (
              <Link href={link(page + 1)} className="font-semibold text-fp-teal-deep hover:underline">
                Next →
              </Link>
            )}
          </span>
        )}
      </div>
    </>
  );
}

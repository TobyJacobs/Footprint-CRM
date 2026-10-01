import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { gbp, longDate } from "@/lib/customers/display";
import { docTypes, statusLabel, statusToneFor, statuses, type DocType } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

// The list page shared by quotes, sales orders and invoices.
export default async function DocumentList({
  docType,
  searchParams,
}: {
  docType: DocType;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermission("quotes", "view");
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { path, plural, label } = docTypes[docType];

  const supabase = await createClient();
  let query = supabase
    .from("sales_documents")
    .select("id, number, status, title, issue_date, valid_until, due_date, total, subtotal, cost_total, customers(name)", {
      count: "exact",
    })
    .eq("doc_type", docType)
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    const { data: hits } = await supabase.from("customers").select("id").ilike("name", like).limit(200);
    const ids = (hits ?? []).map((h) => h.id);
    const parts = [`number.ilike.${like}`, `title.ilike.${like}`, `customer_reference.ilike.${like}`];
    if (ids.length) parts.push(`customer_id.in.(${ids.join(",")})`);
    query = query.or(parts.join(","));
  }
  const { data: docs, count } = await query;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const link = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `${path}${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <Notice searchParams={searchParams} />
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <form action={path} className="flex flex-1 flex-wrap items-end gap-3">
          <label className="grid min-w-[220px] flex-1 gap-1 text-sm">
            <span className="font-semibold">Search</span>
            <input name="q" defaultValue={q} placeholder="Number, customer, title or reference" className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Status</span>
            <select name="status" defaultValue={status} className={inputClass}>
              <option value="">Any</option>
              {statuses[docType].map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={secondaryButton}>
            Search
          </button>
          {(q || status) && (
            <Link href={path} className="py-2 text-sm font-semibold text-fp-teal-deep hover:underline">
              Clear
            </Link>
          )}
        </form>
        {docType === "credit_note" && (
          <p className="text-sm text-fp-dark/75">To raise a credit note, open the invoice and choose “Raise credit note”.</p>
        )}
        {user.can("quotes", "edit") && docType !== "credit_note" && (
          <Link href={`/sales/new?type=${docType}`} className={`${primaryButton} inline-flex items-center gap-2`}>
            <Plus size={16} aria-hidden /> New {label.toLowerCase()}
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-fp-border bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-fp-border bg-fp-offwhite text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="px-4 py-3 font-semibold">Number</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-right font-semibold">GP</th>
            </tr>
          </thead>
          <tbody>
            {(docs ?? []).map((d) => {
              const gp = Number(d.subtotal) - Number(d.cost_total);
              return (
                <tr key={d.id} className="border-b border-fp-border last:border-0 hover:bg-fp-offwhite">
                  <td className="px-4 py-3">
                    <Link href={`/sales/${d.id}`} className="font-semibold hover:text-fp-pink">
                      {d.number}
                    </Link>
                    {d.title && <div className="text-xs text-fp-mid">{d.title}</div>}
                  </td>
                  <td className="px-4 py-3">{(d.customers as unknown as { name: string } | null)?.name}</td>
                  <td className="px-4 py-3">{longDate(d.issue_date)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusToneFor(d.status)}>{statusLabel(docType, d.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{gbp(Number(d.total))}</td>
                  <td className="px-4 py-3 text-right text-fp-dark/70">{gbp(gp)}</td>
                </tr>
              );
            })}
            {(docs ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-fp-mid">
                  {q || status ? `No ${plural.toLowerCase()} match those filters.` : `No ${plural.toLowerCase()} yet.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-fp-dark/75">
        <span>
          {total.toLocaleString("en-GB")} {total === 1 ? label.toLowerCase() : plural.toLowerCase()}
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

import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Notice, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { gbp, longDate } from "@/lib/customers/display";
import { frequencyLabel, recurringStatuses } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";
import { runRecurringBillingNow } from "./actions";

export const metadata: Metadata = { title: "Recurring invoices" };

const tone = (s: string) => (s === "active" ? "teal" : s === "paused" ? "amber" : "grey") as "teal" | "amber" | "grey";

export default async function RecurringPage(props: PageProps<"/sales/recurring">) {
  const user = await requirePermission("quotes", "view");
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "active";
  const supabase = await createClient();
  let query = supabase
    .from("recurring_invoices")
    .select("id, name, frequency, next_date, status, total, auto_issue, customers!recurring_invoices_customer_id_fkey(name)")
    .order("next_date")
    .limit(500);
  if (status !== "all") query = query.eq("status", status);
  const { data: rows } = await query;

  const monthly = (rows ?? [])
    .filter((r) => r.status === "active")
    .reduce((sum, r) => {
      const perYear = { monthly: 12, quarterly: 4, six_monthly: 2, annually: 1 }[r.frequency as string] ?? 12;
      return sum + (Number(r.total) * perYear) / 12;
    }, 0);

  return (
    <>
      <Notice searchParams={sp} />
      {typeof sp.ran === "string" && (
        <p role="status" className="mb-6 rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
          Recurring billing ran: {sp.ran} invoice{sp.ran === "1" ? "" : "s"} created.
        </p>
      )}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {[{ value: "active", label: "Active" }, ...recurringStatuses.filter((s) => s.value !== "active"), { value: "all", label: "All" }].map((s) => (
            <Link
              key={s.value}
              href={`/sales/recurring?status=${s.value}`}
              className={`rounded-full px-3 py-1 font-semibold ${status === s.value ? "bg-fp-black text-white" : "bg-white"}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {user.isAdmin && (
            <form action={runRecurringBillingNow}>
              <button type="submit" className={secondaryButton}>
                Run billing now
              </button>
            </form>
          )}
          {user.can("quotes", "edit") && (
            <Link href="/sales/recurring/new" className={`${primaryButton} inline-flex items-center gap-2`}>
              <Plus size={16} aria-hidden /> New recurring invoice
            </Link>
          )}
        </div>
      </div>

      <p className="mb-4 text-sm text-fp-dark/75">
        Due invoices are created automatically every morning. Active recurring billing is worth about{" "}
        <strong>{gbp(monthly)}</strong> a month (incl. VAT).
      </p>

      <div className="overflow-x-auto rounded-lg border border-fp-border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-fp-border bg-fp-offwhite text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">How often</th>
              <th className="px-4 py-3 font-semibold">Next invoice</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Each time</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-b border-fp-border last:border-0 hover:bg-fp-offwhite">
                <td className="px-4 py-3">
                  <Link href={`/sales/recurring/${r.id}`} className="font-semibold hover:text-fp-pink">
                    {r.name}
                  </Link>
                  {r.auto_issue && <div className="text-xs text-fp-mid">Issued automatically</div>}
                </td>
                <td className="px-4 py-3">{(r.customers as unknown as { name: string } | null)?.name}</td>
                <td className="px-4 py-3">{frequencyLabel(r.frequency)}</td>
                <td className="px-4 py-3">{r.status === "active" ? longDate(r.next_date) : "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={tone(r.status)}>{recurringStatuses.find((s) => s.value === r.status)?.label}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{gbp(Number(r.total))}</td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-fp-mid">
                  No recurring invoices here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Badge, Card, Notice, dangerButton, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { gbp, longDate, shortDateTime } from "@/lib/customers/display";
import { getRecurringLines } from "@/lib/sales/data";
import { frequencyLabel, recurringStatuses, statusLabel, statusToneFor } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";
import { deleteRecurring, generateRecurringNow, setRecurringStatus } from "../actions";

export const metadata: Metadata = { title: "Recurring invoice" };

export default async function RecurringInvoicePage(props: PageProps<"/sales/recurring/[recurringId]">) {
  const user = await requirePermission("quotes", "view");
  const canEdit = user.can("quotes", "edit");
  const { recurringId } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("recurring_invoices")
    .select("*, customers!recurring_invoices_customer_id_fkey(id, name), hosting_plans(id, name), retainers(id, name)")
    .eq("id", recurringId)
    .maybeSingle();
  if (!r) notFound();
  const [lines, { data: invoices }] = await Promise.all([
    getRecurringLines(recurringId),
    supabase
      .from("sales_documents")
      .select("id, number, status, issue_date, total")
      .eq("recurring_invoice_id", recurringId)
      .order("issue_date", { ascending: false })
      .limit(24),
  ]);
  const customer = r.customers as unknown as { id: string; name: string };
  const hosting = r.hosting_plans as unknown as { id: string; name: string } | null;
  const retainer = r.retainers as unknown as { id: string; name: string } | null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/sales/recurring" className="text-sm font-semibold text-fp-teal-deep hover:underline">
            ← Recurring invoices
          </Link>
          <h2 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-black">
            {r.name}
            <Badge tone={r.status === "active" ? "teal" : r.status === "paused" ? "amber" : "grey"}>
              {recurringStatuses.find((s) => s.value === r.status)?.label}
            </Badge>
          </h2>
          <p className="mt-1 text-sm text-fp-dark/75">
            <Link href={`/customers/${customer.id}`} className="font-semibold hover:text-fp-pink">
              {customer.name}
            </Link>{" "}
            · {frequencyLabel(r.frequency)} · {gbp(Number(r.total))} each time
            {hosting && <> · from hosting plan “{hosting.name}”</>}
            {retainer && <> · from retainer “{retainer.name}”</>}
          </p>
        </div>
        {canEdit && (
          <Link href={`/sales/recurring/${recurringId}/edit`} className={`${secondaryButton} inline-flex items-center gap-2`}>
            <Pencil size={14} aria-hidden /> Edit
          </Link>
        )}
      </div>

      <Notice searchParams={sp} />

      <Card title="Next steps">
        <p className="mb-4 text-sm">
          {r.status === "active" ? (
            <>
              Next invoice: <strong>{longDate(r.next_date)}</strong>
              {r.auto_issue ? " — issued automatically." : " — created as a draft to check and issue."}
              {r.end_date && <> Stops after {longDate(r.end_date)}.</>}
            </>
          ) : (
            "No invoices will be created while this is not active."
          )}
          {r.last_run_at && <span className="text-fp-mid"> Last invoice created {shortDateTime(r.last_run_at)}.</span>}
        </p>
        {canEdit && (
          <div className="flex flex-wrap gap-3">
            {r.status === "active" && (
              <form action={generateRecurringNow.bind(null, recurringId)}>
                <ConfirmSubmit
                  className={primaryButton}
                  message={`Create the ${longDate(r.next_date)} invoice now? The next date will then move on.`}
                >
                  Create next invoice now
                </ConfirmSubmit>
              </form>
            )}
            {r.status === "active" && (
              <form action={setRecurringStatus.bind(null, recurringId, "paused")}>
                <button type="submit" className={secondaryButton}>
                  Pause
                </button>
              </form>
            )}
            {r.status === "paused" && (
              <form action={setRecurringStatus.bind(null, recurringId, "active")}>
                <button type="submit" className={primaryButton}>
                  Resume
                </button>
              </form>
            )}
            {r.status !== "ended" && (
              <form action={setRecurringStatus.bind(null, recurringId, "ended")}>
                <ConfirmSubmit className={secondaryButton} message="End this recurring invoice? No more invoices will be created.">
                  End
                </ConfirmSubmit>
              </form>
            )}
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card title="Billed each time">
          <table className="w-full text-left text-sm">
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-b border-fp-border align-top last:border-0">
                  <td className="whitespace-pre-line py-2 pr-3">{l.description}</td>
                  <td className="py-2 pr-3 text-right">{l.quantity} × {gbp(l.unit_price)}</td>
                  <td className="py-2 pr-3 text-right">{l.tax_rate}%</td>
                  <td className="py-2 text-right font-semibold">{gbp(l.line_net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto mt-4 grid max-w-xs grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-fp-dark/75">Subtotal</dt>
            <dd className="text-right">{gbp(Number(r.subtotal))}</dd>
            <dt className="text-fp-dark/75">VAT</dt>
            <dd className="text-right">{gbp(Number(r.vat_total))}</dd>
            <dt className="font-bold">Total</dt>
            <dd className="text-right font-bold">{gbp(Number(r.total))}</dd>
          </dl>
        </Card>
        <Card title="Invoices created">
          {(invoices ?? []).length === 0 ? (
            <p className="text-sm text-fp-mid">None yet.</p>
          ) : (
            <ul className="divide-y divide-fp-border text-sm">
              {(invoices ?? []).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/sales/${i.id}`} className="font-semibold hover:text-fp-pink">
                    {i.number}
                  </Link>
                  <span className="text-fp-mid">{longDate(i.issue_date)}</span>
                  <Badge tone={statusToneFor(i.status)}>{statusLabel("invoice", i.status)}</Badge>
                  <span className="font-semibold">{gbp(Number(i.total))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {user.can("quotes", "delete") && (
        <form action={deleteRecurring.bind(null, recurringId)} className="mt-10 border-t border-fp-border pt-6">
          <p className="mb-3 text-sm text-fp-dark/75">Invoices already created are kept. Usually it&apos;s better to End it instead.</p>
          <ConfirmSubmit className={dangerButton} message={`Delete the recurring invoice "${r.name}"?`}>
            Delete recurring invoice
          </ConfirmSubmit>
        </form>
      )}
    </>
  );
}

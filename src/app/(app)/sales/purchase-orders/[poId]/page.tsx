import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil, Printer } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Badge, Card, Field, Notice, dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { gbp, longDate, shortDateTime } from "@/lib/customers/display";
import { getPurchaseOrderLines } from "@/lib/sales/data";
import { poStatusLabel, statusToneFor } from "@/lib/sales/options";
import { isEmailConfigured, isEmailTestMode } from "@/lib/email/postmark";
import { createClient } from "@/lib/supabase/server";
import { deletePurchaseOrder, setPurchaseOrderStatus } from "../actions";
import { sendPurchaseOrderEmail } from "../email-actions";

export async function generateMetadata(props: PageProps<"/sales/purchase-orders/[poId]">): Promise<Metadata> {
  const { poId } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("purchase_orders").select("number").eq("id", poId).maybeSingle();
  return { title: data?.number ?? "Purchase order" };
}

function StatusButton({ poId, status, children, primary }: { poId: string; status: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <form action={setPurchaseOrderStatus.bind(null, poId, status)}>
      <button type="submit" className={primary ? primaryButton : secondaryButton}>
        {children}
      </button>
    </form>
  );
}

export default async function PurchaseOrderPage(props: PageProps<"/sales/purchase-orders/[poId]">) {
  const user = await requirePermission("quotes", "view");
  const canEdit = user.can("quotes", "edit");
  const { poId } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(*), sales_documents(id, number), customers(id, name), owner:owner_id(full_name, email)")
    .eq("id", poId)
    .maybeSingle();
  if (!po) notFound();
  const [lines, { data: emailLog }, { data: settings }] = await Promise.all([
    getPurchaseOrderLines(poId),
    supabase
      .from("email_log")
      .select("id, to_addresses, status, error, sent_at")
      .eq("purchase_order_id", poId)
      .order("sent_at", { ascending: false })
      .limit(10),
    supabase.from("company_settings").select("company_name").single(),
  ]);
  const supplier = po.suppliers as unknown as { id: string; name: string; email: string | null; phone: string | null; contact_name: string | null };
  const so = po.sales_documents as unknown as { id: string; number: string } | null;
  const customer = po.customers as unknown as { id: string; name: string } | null;
  const owner = po.owner as unknown as { full_name: string | null; email: string } | null;
  const finished = ["received", "closed", "cancelled"].includes(po.status);
  const company = settings?.company_name ?? "Footprint Group";
  const emailed = typeof sp.emailed === "string" ? sp.emailed : null;
  const raisedBy = owner ? (owner.full_name ?? owner.email) : company;
  const supplierMessage = `${supplier.contact_name ? `Hi ${supplier.contact_name.split(" ")[0]},` : "Hello,"}

Please supply the items below against our purchase order ${po.number}, and quote this number on your invoice and delivery note.

Could you confirm receipt and the expected delivery date?

Kind regards,
${raisedBy}
${company}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/sales/purchase-orders" className="text-sm font-semibold text-fp-teal-deep hover:underline">
            ← Purchase orders
          </Link>
          <h2 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-black">
            Purchase order {po.number}
            <Badge tone={statusToneFor(po.status)}>{poStatusLabel(po.status)}</Badge>
          </h2>
          <p className="mt-1 text-sm text-fp-dark/75">
            To{" "}
            <Link href={`/sales/suppliers/${supplier.id}`} className="font-semibold hover:text-fp-pink">
              {supplier.name}
            </Link>
            {so && (
              <>
                {" "}· for sales order{" "}
                <Link href={`/sales/${so.id}`} className="font-semibold hover:text-fp-pink">
                  {so.number}
                </Link>
              </>
            )}
            {customer && (
              <>
                {" "}(
                <Link href={`/customers/${customer.id}`} className="hover:text-fp-pink">
                  {customer.name}
                </Link>
                )
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/sales/purchase-orders/${poId}/print`} className={`${secondaryButton} inline-flex items-center gap-2`}>
            <Printer size={14} aria-hidden /> Print / PDF
          </Link>
          {canEdit && !finished && (
            <Link href={`/sales/purchase-orders/${poId}/edit`} className={`${secondaryButton} inline-flex items-center gap-2`}>
              <Pencil size={14} aria-hidden /> Edit
            </Link>
          )}
        </div>
      </div>

      <Notice searchParams={sp} />

      {canEdit && (
        <Card title="Next steps">
          <div className="flex flex-wrap items-center gap-3">
            {po.status === "draft" && (
              <StatusButton poId={poId} status="sent">
                Mark as sent (ordered by phone)
              </StatusButton>
            )}
            {po.status === "sent" && (
              <StatusButton poId={poId} status="received" primary>
                Mark goods received
              </StatusButton>
            )}
            {po.status === "received" && (
              <StatusButton poId={poId} status="closed" primary>
                Close (supplier&apos;s bill checked)
              </StatusButton>
            )}
            {["draft", "sent"].includes(po.status) && (
              <form action={setPurchaseOrderStatus.bind(null, poId, "cancelled")}>
                <ConfirmSubmit className={secondaryButton} message={`Cancel purchase order ${po.number}?`}>
                  Cancel purchase order
                </ConfirmSubmit>
              </form>
            )}
            {finished && <p className="text-sm text-fp-dark/75">This purchase order is finished.</p>}
          </div>
        </Card>
      )}

      {emailed && (
        <p role="status" className="mt-6 rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
          {emailed === "test" ? "Order email accepted in test mode (not actually delivered)." : "Order emailed to the supplier."}
        </p>
      )}

      {canEdit && ["draft", "sent"].includes(po.status) && (
        <div className="mt-6">
          <Card title="Place order with supplier">
            {!isEmailConfigured() ? (
              <p className="text-sm text-fp-dark/75">Email isn&apos;t switched on yet. Once Postmark is set up, you&apos;ll be able to email orders from here.</p>
            ) : (
              <form action={sendPurchaseOrderEmail.bind(null, poId)} className="grid gap-3">
                {isEmailTestMode() && (
                  <p className="rounded-md bg-fp-amber/15 px-3 py-2 text-xs">
                    Test mode: emails are accepted by Postmark but <strong>not delivered</strong>.
                  </p>
                )}
                <Field label="To">
                  <input name="to" type="text" defaultValue={supplier.email ?? ""} required className={inputClass} placeholder="orders@supplier.co.uk" />
                </Field>
                <Field label="CC (optional)">
                  <input name="cc" type="text" className={inputClass} placeholder="Separate several with commas" />
                </Field>
                <Field label="Subject">
                  <input name="subject" defaultValue={`${(emailLog ?? []).length ? "Reminder: " : ""}Purchase order ${po.number} from ${company}`} required className={inputClass} />
                </Field>
                <Field label="Message" hint="The order lines, delivery address and needed-by date are added automatically.">
                  <textarea name="message" rows={8} defaultValue={supplierMessage} required className={inputClass} />
                </Field>
                <div>
                  <button type="submit" className={`${primaryButton} inline-flex items-center gap-2`}>
                    <Mail size={14} aria-hidden /> {(emailLog ?? []).length ? "Resend order to supplier" : "Email order to supplier"}
                  </button>
                </div>
              </form>
            )}
            {(emailLog ?? []).length > 0 && (
              <ul className="mt-5 grid gap-2 border-t border-fp-border pt-4 text-sm">
                {(emailLog ?? []).map((e) => (
                  <li key={e.id}>
                    <span className="mr-2">
                      <Badge tone={e.status === "failed" ? "red" : e.status === "test" ? "amber" : "teal"}>
                        {e.status === "test" ? "Test" : e.status === "failed" ? "Failed" : "Sent"}
                      </Badge>
                    </span>
                    {shortDateTime(e.sent_at)} to {e.to_addresses}
                    {e.error && <span className="block text-xs text-fp-error">{e.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card title="Lines">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Description</th>
                  <th className="py-2 pr-3 text-right font-semibold">Qty</th>
                  <th className="py-2 pr-3 text-right font-semibold">Cost</th>
                  <th className="py-2 pr-3 text-right font-semibold">VAT</th>
                  <th className="py-2 text-right font-semibold">Net</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} className="border-b border-fp-border align-top last:border-0">
                    <td className="whitespace-pre-line py-2 pr-3">{l.description}</td>
                    <td className="py-2 pr-3 text-right">{l.quantity}</td>
                    <td className="py-2 pr-3 text-right">{gbp(l.unit_cost)}</td>
                    <td className="py-2 pr-3 text-right">{l.tax_rate}%</td>
                    <td className="py-2 text-right font-semibold">{gbp(l.line_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto mt-4 grid max-w-xs grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-fp-dark/75">Subtotal</dt>
            <dd className="text-right">{gbp(Number(po.subtotal))}</dd>
            <dt className="text-fp-dark/75">VAT</dt>
            <dd className="text-right">{gbp(Number(po.vat_total))}</dd>
            <dt className="font-bold">Total</dt>
            <dd className="text-right font-bold">{gbp(Number(po.total))}</dd>
          </dl>
        </Card>
        <div className="grid content-start gap-6">
          <Card title="Details">
            <dl className="grid gap-2 text-sm">
              {[
                ["Date", longDate(po.issue_date)],
                ["Needed by", longDate(po.expected_date)],
                ["Deliver to", po.deliver_to],
                ["Supplier's reference", po.supplier_reference],
                ["Supplier contact", [supplier.contact_name, supplier.email, supplier.phone].filter(Boolean).join(" · ")],
                ["Raised by", owner ? (owner.full_name ?? owner.email) : null],
                ["Sent", shortDateTime(po.sent_at)],
                ["Received", shortDateTime(po.received_at)],
              ]
                .filter(([, val]) => val)
                .map(([k, val]) => (
                  <div key={k as string} className="grid grid-cols-2 gap-2">
                    <dt className="text-fp-dark/75">{k}</dt>
                    <dd>{val}</dd>
                  </div>
                ))}
            </dl>
          </Card>
          {po.internal_notes && (
            <Card title="Internal notes">
              <p className="whitespace-pre-line text-sm">{po.internal_notes}</p>
            </Card>
          )}
        </div>
      </div>

      {user.can("quotes", "delete") && po.status === "draft" && (
        <form action={deletePurchaseOrder.bind(null, poId)} className="mt-10 border-t border-fp-border pt-6">
          <ConfirmSubmit className={dangerButton} message={`Delete purchase order ${po.number}?`}>
            Delete purchase order
          </ConfirmSubmit>
        </form>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil, Printer } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Badge, Card, Field, Notice, dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { gbp, longDate, shortDateTime } from "@/lib/customers/display";
import { getPurchaseOrderLines, getSuppliers } from "@/lib/sales/data";
import { poOrderMethods, poOrderedViaLabel, poStatusLabel, statusToneFor } from "@/lib/sales/options";
import { isEmailConfigured, isEmailTestMode } from "@/lib/email/sendgrid";
import EmailStatus from "@/components/EmailStatus";
import { createClient } from "@/lib/supabase/server";
import { deletePurchaseOrder, markPoOrderedManually, raiseShortfallPo, savePoActualCosts, savePoTracking, setPurchaseOrderStatus } from "../actions";
import { poStages } from "@/lib/sales/stages";
import { StageBar } from "../../../[id]/SalesOrderSections";
import { ExternalLink } from "lucide-react";
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
    .select("*, suppliers(*), sales_documents(id, number), customers(id, name), owner:owner_id(full_name, email), orderer:ordered_by(full_name, email)")
    .eq("id", poId)
    .maybeSingle();
  if (!po) notFound();
  const [lines, { data: emailLog }, { data: settings }, suppliers] = await Promise.all([
    getPurchaseOrderLines(poId),
    supabase
      .from("email_log")
      .select("id, to_addresses, subject, status, error, sent_at, delivery_status, delivery_detail, delivery_at")
      .eq("purchase_order_id", poId)
      .order("sent_at", { ascending: false })
      .limit(10),
    supabase.from("company_settings").select("company_name").single(),
    getSuppliers(),
  ]);
  const supplier = po.suppliers as unknown as { id: string; name: string; email: string | null; phone: string | null; contact_name: string | null };
  const so = po.sales_documents as unknown as { id: string; number: string } | null;
  const customer = po.customers as unknown as { id: string; name: string } | null;
  const owner = po.owner as unknown as { full_name: string | null; email: string } | null;
  const orderer = po.orderer as unknown as { full_name: string | null; email: string } | null;
  const orderedVia = poOrderedViaLabel(po.ordered_via);
  // Actual costs (what we bought it for) against what it should cost.
  const canEnterCosts = canEdit && po.status !== "cancelled";
  const withActual = lines.filter((l) => l.actual_line_net !== null);
  const actualCount = withActual.length;
  const actualNet = Math.round(withActual.reduce((sum, l) => sum + (l.actual_line_net ?? 0), 0) * 100) / 100;
  // Compared on the quantity actually bought, so a short delivery isn't a "saving".
  const shouldFor = (l: (typeof lines)[number]) => Math.round((l.bought_quantity ?? l.quantity) * l.unit_cost * 100) / 100;
  const actualDiff = Math.round(withActual.reduce((sum, l) => sum + (l.actual_line_net ?? 0) - shouldFor(l), 0) * 100) / 100;
  // Lines where the supplier couldn't supply everything (DJ, 11 November 2026).
  const shortLines = lines.filter((l) => l.bought_quantity !== null && l.bought_quantity < l.quantity);
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

      {/* Progress (DJ, 11 November 2026). */}
      <div className="mb-6">
        <StageBar
          label="Purchase order progress"
          {...poStages({ status: po.status, orderedVia, tracking: !!po.tracking_url, shortLines: shortLines.length })}
        />
      </div>

      {/* Delivery tracking (DJ, 11 November 2026). */}
      <div id="tracking" className="mb-6">
        <Card title="Tracking">
          {po.tracking_url ? (
            <p className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <a href={po.tracking_url} target="_blank" rel="noopener noreferrer" className={`${primaryButton} inline-flex items-center gap-2`}>
                <ExternalLink size={14} aria-hidden /> Track delivery
              </a>
              {po.tracking_note && <span className="text-fp-dark/75">{po.tracking_note}</span>}
            </p>
          ) : (
            <p className="mb-3 text-sm text-fp-mid">No tracking link yet.</p>
          )}
          {canEdit && po.status !== "cancelled" && (
            <form action={savePoTracking.bind(null, poId)} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
              <Field label="Tracking link">
                <input name="tracking_url" type="text" inputMode="url" maxLength={1000} defaultValue={po.tracking_url ?? ""} className={inputClass} placeholder="https://track.dpd.co.uk/…" />
              </Field>
              <Field label="Courier or tracking number (optional)">
                <input name="tracking_note" maxLength={200} defaultValue={po.tracking_note ?? ""} className={inputClass} placeholder="e.g. DPD 1550 1234 5678" />
              </Field>
              <button type="submit" className={secondaryButton}>
                Save tracking
              </button>
            </form>
          )}
        </Card>
      </div>

      {/* How it was ordered (DJ, 11 November 2026). */}
      {orderedVia && po.status !== "draft" && (
        <p className="mb-6 rounded-md border border-fp-border bg-white px-4 py-3 text-sm">
          <strong>Ordered {orderedVia.charAt(0).toLowerCase() + orderedVia.slice(1)}</strong>
          {orderer ? ` by ${orderer.full_name ?? orderer.email}` : ""}
          {po.sent_at ? ` on ${shortDateTime(po.sent_at)}` : ""}
          {po.ordered_note ? `: ${po.ordered_note}` : "."}
        </p>
      )}

      {canEdit && (
        <Card title="Next steps">
          <div className="flex flex-wrap items-center gap-3">
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
              <p className="text-sm text-fp-dark/75">Email isn&apos;t switched on yet. Once SendGrid is set up, you&apos;ll be able to email orders from here.</p>
            ) : (
              <form action={sendPurchaseOrderEmail.bind(null, poId)} className="grid gap-3">
                {isEmailTestMode() && (
                  <p className="rounded-md bg-fp-amber/15 px-3 py-2 text-xs">
                    Test mode: emails are accepted by SendGrid but <strong>not delivered</strong>.
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
            {/* Or placed another way: phone, website, in person (DJ, 11 November 2026). */}
            <form action={markPoOrderedManually.bind(null, poId)} className="mt-5 grid gap-3 border-t border-fp-border pt-4">
              <p className="text-sm font-semibold">Or ordered manually</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="How">
                  <select name="ordered_via" required defaultValue={po.ordered_via && po.ordered_via !== "email" ? po.ordered_via : ""} className={inputClass}>
                    <option value="" disabled>
                      Choose…
                    </option>
                    {poOrderMethods.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Note (optional)">
                  <input name="ordered_note" maxLength={500} defaultValue={po.ordered_via !== "email" ? (po.ordered_note ?? "") : ""} className={inputClass} placeholder="e.g. spoke to Sam, order ref 4471" />
                </Field>
              </div>
              <div>
                <button type="submit" className={secondaryButton}>
                  Mark as ordered (no email)
                </button>
              </div>
            </form>
            {(emailLog ?? []).length > 0 && (
              <ul className="mt-5 grid gap-2 border-t border-fp-border pt-4 text-sm">
                {(emailLog ?? []).map((e) => (
                  <li key={e.id}>
                    {shortDateTime(e.sent_at)} to {e.to_addresses}
                    <span className="block">
                      <EmailStatus e={e} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* What each line should cost vs what we bought it for (DJ, 11 November 2026). */}
        <Card title="Lines">
          <div id="costs" className="-mt-2" />
          <form action={savePoActualCosts.bind(null, poId)}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Description</th>
                    <th className="py-2 pr-3 text-right font-semibold">Qty ordered</th>
                    <th className="py-2 pr-3 text-right font-semibold">Qty bought</th>
                    <th className="py-2 pr-3 text-right font-semibold">Should cost (each)</th>
                    <th className="py-2 pr-3 text-right font-semibold">Bought for (each)</th>
                    <th className="py-2 pr-3 text-right font-semibold">VAT</th>
                    <th className="py-2 pr-3 text-right font-semibold">Net</th>
                    <th className="py-2 text-right font-semibold">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const diff = l.actual_line_net === null ? null : Math.round((l.actual_line_net - shouldFor(l)) * 100) / 100;
                    const short = l.bought_quantity !== null && l.bought_quantity < l.quantity ? Math.round((l.quantity - l.bought_quantity) * 1000) / 1000 : 0;
                    return (
                      <tr key={l.key} className="border-b border-fp-border align-top last:border-0">
                        <td className="whitespace-pre-line py-2 pr-3">{l.description}</td>
                        <td className="py-2 pr-3 text-right">{l.quantity}</td>
                        <td className="py-2 pr-3 text-right">
                          {canEnterCosts ? (
                            <input
                              name={`bought:${l.key}`}
                              type="number"
                              step="any"
                              min="0"
                              defaultValue={l.bought_quantity ?? l.quantity}
                              aria-label={`How many ${l.description.split("\n")[0]} we bought`}
                              className={`${inputClass} w-20 text-right`}
                            />
                          ) : (
                            (l.bought_quantity ?? l.quantity)
                          )}
                          {short > 0 && <span className="mt-1 block text-xs font-semibold text-fp-orange">{short} short</span>}
                        </td>
                        <td className="py-2 pr-3 text-right">{gbp(l.unit_cost)}</td>
                        <td className="py-2 pr-3 text-right">
                          {canEnterCosts ? (
                            <input
                              name={`actual:${l.key}`}
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={l.actual_unit_cost ?? ""}
                              aria-label={`What we bought ${l.description.split("\n")[0]} for, each`}
                              className={`${inputClass} w-28 text-right`}
                            />
                          ) : l.actual_unit_cost === null ? (
                            <span className="text-fp-mid">—</span>
                          ) : (
                            gbp(l.actual_unit_cost)
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right">{l.tax_rate}%</td>
                        <td className="py-2 pr-3 text-right font-semibold">{gbp(l.line_net)}</td>
                        <td className={`py-2 text-right font-semibold ${diff === null || diff === 0 ? "" : diff > 0 ? "text-fp-error" : "text-fp-teal-deep"}`}>
                          {diff === null ? <span className="font-normal text-fp-mid">—</span> : diff === 0 ? "None" : `${diff > 0 ? "+" : "−"}${gbp(Math.abs(diff))}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canEnterCosts && lines.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="submit" className={secondaryButton}>
                  Save what we bought
                </button>
                <span className="text-xs text-fp-mid">
                  Change Qty bought if the supplier couldn&apos;t supply them all. Enter the price each, before VAT, from their bill (blank if not known yet).
                </span>
              </div>
            )}
          </form>
          <dl className="ml-auto mt-4 grid max-w-sm grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-fp-dark/75">Should cost (before VAT)</dt>
            <dd className="text-right">{gbp(Number(po.subtotal))}</dd>
            {actualCount > 0 && (
              <>
                <dt className="text-fp-dark/75">Bought for (before VAT){actualCount < lines.length ? ` · ${actualCount} of ${lines.length} lines` : ""}</dt>
                <dd className="text-right">{gbp(actualNet)}</dd>
                <dt className="font-semibold">Difference</dt>
                <dd className={`text-right font-semibold ${actualDiff > 0 ? "text-fp-error" : actualDiff < 0 ? "text-fp-teal-deep" : ""}`}>
                  {actualDiff === 0 ? "None" : `${actualDiff > 0 ? "+" : "−"}${gbp(Math.abs(actualDiff))} ${actualDiff > 0 ? "over" : "under"}`}
                </dd>
              </>
            )}
            <dt className="mt-2 text-fp-dark/75">VAT</dt>
            <dd className="mt-2 text-right">{gbp(Number(po.vat_total))}</dd>
            <dt className="font-bold">Total</dt>
            <dd className="text-right font-bold">{gbp(Number(po.total))}</dd>
          </dl>
        {/* Order what's short from another supplier (DJ, 11 November 2026). */}
        {canEnterCosts && shortLines.length > 0 && (
          <section className="mt-5 rounded-md border border-fp-orange/40 bg-fp-orange/5 p-4">
            <h3 className="mb-2 font-bold">Order the shortfall</h3>
              <p className="mb-3 text-sm">
                {shortLines.map((l) => `${Math.round((l.quantity - (l.bought_quantity ?? 0)) * 1000) / 1000} × ${l.description.split("\n")[0]}`).join(", ")} still to get.
                Pick another supplier to raise a new draft purchase order for just these.
              </p>
              <form action={raiseShortfallPo.bind(null, poId)} className="flex flex-wrap items-end gap-3">
                <Field label="Supplier">
                  <select name="supplier_id" required defaultValue="" className={inputClass}>
                    <option value="" disabled>
                      Choose a supplier…
                    </option>
                    {suppliers
                      .filter((s) => s.id !== supplier.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <button type="submit" className={primaryButton}>
                  Order the shortfall
                </button>
              </form>
          </section>
        )}
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

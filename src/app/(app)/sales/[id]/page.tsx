import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Pencil, Printer } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import CopyButton from "@/components/CopyButton";
import { Badge, Card, Notice, dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { gbp, longDate, personName, shortDateTime } from "@/lib/customers/display";
import { getDocumentLines } from "@/lib/sales/data";
import {
  docTypes, isDocType, isLockedRecord, marginPercent, poStatusLabel, statusLabel, statusToneFor, type DocType,
} from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";
import { clearGpOverride, convertDocument, deleteDocument, setDocumentStatus, setGpOverride } from "../actions";
import { raisePurchaseOrders } from "../purchase-orders/actions";
import EmailCard from "../EmailCard";

export async function generateMetadata(props: PageProps<"/sales/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("sales_documents").select("number").eq("id", id).maybeSingle();
  return { title: data?.number ?? "Document" };
}

function ActionButton({ action, children, tone = "secondary" }: { action: () => Promise<void>; children: React.ReactNode; tone?: "primary" | "secondary" }) {
  return (
    <form action={action}>
      <button type="submit" className={tone === "primary" ? primaryButton : secondaryButton}>
        {children}
      </button>
    </form>
  );
}

export default async function DocumentPage(props: PageProps<"/sales/[id]">) {
  const user = await requirePermission("quotes", "view");
  const canEdit = user.can("quotes", "edit");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();

  const { data: doc, error: loadError } = await supabase
    .from("sales_documents")
    .select("*, customers!sales_documents_customer_id_fkey(id, name, credit_status), contacts(first_name, last_name, email), owner:owner_id(full_name, email)")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new Error(`Couldn't load document: ${loadError.message}`);
  if (!doc || !isDocType(doc.doc_type)) notFound();
  const type = doc.doc_type as DocType;

  const [lines, { data: source }, { data: children }, { data: pos }, { data: emailLog }, { data: settings }, { data: canOverrideGp }, { data: overrider }] = await Promise.all([
    getDocumentLines(id),
    doc.source_document_id
      ? supabase.from("sales_documents").select("id, number, doc_type").eq("id", doc.source_document_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("sales_documents").select("id, number, doc_type, status, total").eq("source_document_id", id),
    type === "sales_order"
      ? supabase.from("purchase_orders").select("id, number, status, total, suppliers(name)").eq("sales_document_id", id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("email_log")
      .select("id, to_addresses, subject, status, error, sent_at")
      .eq("sales_document_id", id)
      .order("sent_at", { ascending: false })
      .limit(10),
    supabase.from("company_settings").select("company_name").single(),
    supabase.rpc("can_override_gp"),
    doc.gp_override_by
      ? supabase.from("profiles").select("full_name, email").eq("id", doc.gp_override_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const customer = doc.customers as unknown as { id: string; name: string; credit_status: string | null };
  const contact = doc.contacts as unknown as { first_name: string | null; last_name: string; email: string | null } | null;
  const owner = doc.owner as unknown as { full_name: string | null; email: string } | null;
  const finalised = ["accepted", "converted", "paid", "void", "invoiced"].includes(doc.status) || isLockedRecord(type, doc.status);

  // For invoices: credit notes raised against it reduce what's owed.
  const credits = (children ?? []).filter((c) => c.doc_type === "credit_note" && c.status === "issued");
  const credited = credits.reduce((sum, c) => sum + Number(c.total), 0);
  const balance = Number(doc.total) - credited;
  const margin = marginPercent(Number(doc.subtotal), Number(doc.cost_total));

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const approvalLink = `${origin}/q/${doc.public_token}`;
  const viewLink = `${origin}/d/${doc.public_token}`;
  const emailed = typeof sp.emailed === "string" ? sp.emailed : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={docTypes[type].path} className="text-sm font-semibold text-fp-teal-deep hover:underline">
            ← {docTypes[type].plural}
          </Link>
          <h2 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-black">
            {docTypes[type].label} {doc.number}
            <Badge tone={statusToneFor(doc.status)}>{statusLabel(type, doc.status)}</Badge>
          </h2>
          <p className="mt-1 text-sm text-fp-dark/75">
            <Link href={`/customers/${customer.id}`} className="font-semibold hover:text-fp-pink">
              {customer.name}
            </Link>
            {contact && ` · FAO ${personName(contact)}`}
            {doc.title && ` · ${doc.title}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/sales/${id}/print`} className={`${secondaryButton} inline-flex items-center gap-2`}>
            <Printer size={14} aria-hidden /> Print / PDF
          </Link>
          {canEdit && !finalised && (
            <Link href={`/sales/${id}/edit`} className={`${secondaryButton} inline-flex items-center gap-2`}>
              <Pencil size={14} aria-hidden /> Edit
            </Link>
          )}
        </div>
      </div>

      <Notice searchParams={sp} />

      {customer.credit_status && /ON STOP|Up Front|before we order/i.test(customer.credit_status) && (
        <p className="mb-6 rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-sm text-fp-error">
          Credit warning for this customer: {customer.credit_status}
        </p>
      )}

      {canEdit && (
        <Card title="Next steps">
          <div className="flex flex-wrap items-center gap-3">
            {type === "quote" && doc.status === "draft" && (
              <ActionButton action={setDocumentStatus.bind(null, id, "sent")} tone="primary">
                Mark as sent & get approval link
              </ActionButton>
            )}
            {type === "quote" && ["sent", "accepted", "declined"].includes(doc.status) && (
              <ActionButton action={convertDocument.bind(null, id, "sales_order")} tone={doc.status === "accepted" ? "primary" : "secondary"}>
                Convert to sales order
              </ActionButton>
            )}
            {type === "quote" && doc.status === "sent" && (
              <>
                <ActionButton action={setDocumentStatus.bind(null, id, "accepted")}>Mark accepted (by phone/email)</ActionButton>
                <ActionButton action={setDocumentStatus.bind(null, id, "declined")}>Mark declined</ActionButton>
              </>
            )}
            {type === "sales_order" && ["open", "completed"].includes(doc.status) && (
              <ActionButton action={convertDocument.bind(null, id, "invoice")} tone="primary">
                Create invoice
              </ActionButton>
            )}
            {type === "sales_order" && ["open", "completed", "invoiced"].includes(doc.status) && (
              <ActionButton action={raisePurchaseOrders.bind(null, id)}>Order from suppliers (raise POs)</ActionButton>
            )}
            {type === "sales_order" && doc.status === "open" && (
              <>
                <ActionButton action={setDocumentStatus.bind(null, id, "completed")}>Mark completed</ActionButton>
                <ActionButton action={setDocumentStatus.bind(null, id, "cancelled")}>Cancel order</ActionButton>
              </>
            )}
            {type === "invoice" && ["issued", "paid"].includes(doc.status) && (
              <ActionButton action={convertDocument.bind(null, id, "credit_note")}>Raise credit note</ActionButton>
            )}
            {type === "credit_note" && doc.status === "draft" && (
              <ActionButton action={setDocumentStatus.bind(null, id, "issued")} tone="primary">
                Issue credit note
              </ActionButton>
            )}
            {type === "credit_note" && doc.status === "issued" && (
              <form action={setDocumentStatus.bind(null, id, "void")}>
                <ConfirmSubmit className={secondaryButton} message={`Void credit note ${doc.number}?`}>
                  Void credit note
                </ConfirmSubmit>
              </form>
            )}
            {type === "invoice" && doc.status === "draft" && (
              <ActionButton action={setDocumentStatus.bind(null, id, "issued")} tone="primary">
                Issue invoice
              </ActionButton>
            )}
            {type === "invoice" && doc.status === "issued" && (
              <>
                <ActionButton action={setDocumentStatus.bind(null, id, "paid")} tone="primary">
                  Mark as paid
                </ActionButton>
                <form action={setDocumentStatus.bind(null, id, "void")}>
                  <ConfirmSubmit className={secondaryButton} message={`Void invoice ${doc.number}? It stays on record but no longer counts.`}>
                    Void invoice
                  </ConfirmSubmit>
                </form>
              </>
            )}
            {["paid", "void", "converted", "invoiced"].includes(doc.status) && (
              <p className="text-sm text-fp-dark/75">This document is finalised and can no longer be changed.</p>
            )}
          </div>

          {type === "quote" && doc.status !== "draft" && (
            <div className="mt-5 rounded-md bg-fp-offwhite p-4 text-sm">
              <p className="font-semibold">Customer approval link</p>
              <p className="mb-2 text-fp-dark/75">
                Send this private link to the customer. They can view the quote and accept or decline it — no login needed.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-white px-2 py-1 text-xs">{approvalLink}</code>
                <CopyButton text={approvalLink} label="Copy link" />
              </div>
            </div>
          )}
          {type !== "quote" && doc.status !== "draft" && (
            <div className="mt-5 rounded-md bg-fp-offwhite p-4 text-sm">
              <p className="font-semibold">Customer view link</p>
              <p className="mb-2 text-fp-dark/75">A private, read-only link the customer can open and print — no login needed.</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-white px-2 py-1 text-xs">{viewLink}</code>
                <CopyButton text={viewLink} label="Copy link" />
              </div>
            </div>
          )}
        </Card>
      )}

      {emailed && (
        <p role="status" className="mt-6 rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
          {emailed === "test" ? "Email accepted in test mode (not actually delivered)." : "Email sent."}
        </p>
      )}

      {canEdit && !["void", "cancelled"].includes(doc.status) && (
        <div className="mt-6">
          <EmailCard
            documentId={id}
            type={type}
            number={doc.number}
            total={gbp(Number(doc.total)) ?? ""}
            dueDate={type === "invoice" ? longDate(doc.due_date) : null}
            contactEmail={contact?.email ?? null}
            contactFirstName={contact?.first_name ?? null}
            senderName={user.fullName ?? user.email}
            companyName={settings?.company_name ?? "Footprint Group"}
            log={emailLog ?? []}
          />
        </div>
      )}

      {doc.responded_at && (
        <div className="mt-6">
          <Card title="Customer's response">
            <p className="text-sm">
              <Badge tone={doc.status === "declined" ? "red" : "teal"}>{doc.status === "declined" ? "Declined" : "Accepted"}</Badge>{" "}
              by <strong>{doc.response_name}</strong> on {shortDateTime(doc.responded_at)}
              {doc.response_po && <> · their PO: <strong>{doc.response_po}</strong></>}
              {doc.response_ip && <span className="text-fp-mid"> · from {doc.response_ip}</span>}
            </p>
            {doc.response_note && <p className="mt-2 whitespace-pre-line text-sm">“{doc.response_note}”</p>}
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card title="Lines">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Description</th>
                  <th className="py-2 pr-3 text-right font-semibold">Qty</th>
                  <th className="py-2 pr-3 text-right font-semibold">Price</th>
                  <th className="py-2 pr-3 text-right font-semibold">Disc</th>
                  <th className="py-2 pr-3 text-right font-semibold">VAT</th>
                  <th className="py-2 text-right font-semibold">Net</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} className="border-b border-fp-border align-top last:border-0">
                    <td className="whitespace-pre-line py-2 pr-3">{l.description}</td>
                    <td className="py-2 pr-3 text-right">{l.quantity}</td>
                    <td className="py-2 pr-3 text-right">{gbp(l.unit_price)}</td>
                    <td className="py-2 pr-3 text-right">{l.discount_percent ? `${l.discount_percent}%` : ""}</td>
                    <td className="py-2 pr-3 text-right">{l.tax_rate}%</td>
                    <td className="py-2 text-right font-semibold">{gbp(l.line_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto mt-4 grid max-w-xs grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-fp-dark/75">Subtotal</dt>
            <dd className="text-right">{gbp(Number(doc.subtotal))}</dd>
            <dt className="text-fp-dark/75">VAT</dt>
            <dd className="text-right">{gbp(Number(doc.vat_total))}</dd>
            <dt className="font-bold">Total</dt>
            <dd className="text-right font-bold">{gbp(Number(doc.total))}</dd>
            {type === "invoice" && credited > 0 && (
              <>
                <dt className="text-fp-dark/75">Credited</dt>
                <dd className="text-right">−{gbp(credited)}</dd>
                <dt className="font-bold">Balance</dt>
                <dd className="text-right font-bold">{gbp(balance)}</dd>
              </>
            )}
          </dl>
        </Card>

        <div className="grid content-start gap-6">
          <Card title="Margin">
            <p className="text-3xl font-black text-fp-teal-deep">{margin === null ? "—" : `${margin}%`}</p>
            <p className="mb-3 text-xs text-fp-mid">Staff only — customers never see cost or margin.</p>
            {doc.gp_override !== null && (
              <p className="mb-3 rounded-md bg-fp-amber/15 px-3 py-2 text-xs">
                <strong>GP overridden</strong> to {gbp(Number(doc.gp_override))} by{" "}
                {overrider ? (overrider.full_name ?? overrider.email) : "someone"}
                {doc.gp_override_at ? ` on ${shortDateTime(doc.gp_override_at)}` : ""}. Reason: {doc.gp_override_reason}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-fp-dark/75">Cost</dt>
              <dd className="text-right">{gbp(Number(doc.cost_total))}</dd>
              {doc.labour_cost !== null && (
                <>
                  <dt className="text-fp-dark/75">Labour cost</dt>
                  <dd className="text-right">{gbp(Number(doc.labour_cost))}</dd>
                </>
              )}
            </dl>
            {canOverrideGp === true && canEdit && (
              <details className="mt-4 border-t border-fp-border pt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-fp-teal-deep">
                  {doc.gp_override !== null ? "Change or remove the GP override" : "Override GP"}
                </summary>
                <p className="mt-2 text-xs text-fp-dark/70">
                  If the calculated numbers are wrong, enter the gross profit (in £, excluding VAT) this {docTypes[type].label.toLowerCase()} should show.
                  It stays at that figure, even if lines change, until you remove the override.
                </p>
                <form action={setGpOverride.bind(null, id)} className="mt-2 grid gap-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold">Gross profit (£)</span>
                    <input name="gp" type="number" step="0.01" required defaultValue={doc.gp_override ?? ""} className={inputClass} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold">Reason</span>
                    <input name="reason" required defaultValue={doc.gp_override_reason ?? ""} className={inputClass} placeholder="e.g. supplier cost was wrong" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className={primaryButton}>Save override</button>
                  </div>
                </form>
                {doc.gp_override !== null && (
                  <form action={clearGpOverride.bind(null, id)} className="mt-2">
                    <button type="submit" className="text-xs font-semibold text-fp-dark/70 underline hover:text-fp-black">
                      Remove the override (go back to the calculated figure)
                    </button>
                  </form>
                )}
              </details>
            )}
          </Card>

          <Card title="Details">
            <dl className="grid gap-2 text-sm">
              {[
                ["Date", longDate(doc.issue_date)],
                ["Valid until", type === "quote" ? longDate(doc.valid_until) : null],
                ["Due", type === "invoice" ? longDate(doc.due_date) : null],
                ["Deadline", type === "sales_order" ? longDate(doc.deadline_date) : null],
                ["Production step", doc.production_step],
                ["Customer reference", doc.customer_reference],
                ["Salesperson", owner ? (owner.full_name ?? owner.email) : null],
                ["Business unit", doc.business_unit],
                ["Probability", doc.probability],
                ["Expected", doc.expected_date],
                ["Delivery", doc.delivery_type],
                ["Reason for loss", doc.reason_for_loss],
                ["Reason for credit", doc.credit_reason],
                ["Copy shop job", doc.copy_shop_job ? (doc.consumer_copy_shop ? "Yes (consumer)" : "Yes") : null],
                ["Collected", type === "invoice" ? (doc.collected ? "Yes" : "No") : null],
                ["Sent", shortDateTime(doc.sent_at)],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k as string} className="grid grid-cols-2 gap-2">
                    <dt className="text-fp-dark/75">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
          </Card>

          {(pos ?? []).length > 0 && (
            <Card title="Purchase orders">
              <ul className="grid gap-1 text-sm">
                {(pos ?? []).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <Link href={`/sales/purchase-orders/${p.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                      {p.number}
                    </Link>
                    <span className="text-fp-dark/75">{(p.suppliers as unknown as { name: string } | null)?.name}</span>
                    <Badge tone={statusToneFor(p.status)}>{poStatusLabel(p.status)}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(source || (children ?? []).length > 0) && (
            <Card title="Linked documents">
              <ul className="grid gap-1 text-sm">
                {source && (
                  <li>
                    From{" "}
                    <Link href={`/sales/${source.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                      {docTypes[source.doc_type as DocType]?.label} {source.number}
                    </Link>
                  </li>
                )}
                {(children ?? []).map((c) => (
                  <li key={c.id}>
                    Became{" "}
                    <Link href={`/sales/${c.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                      {docTypes[c.doc_type as DocType]?.label} {c.number}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {doc.internal_notes && (
            <Card title="Internal notes">
              <p className="whitespace-pre-line text-sm">{doc.internal_notes}</p>
            </Card>
          )}
        </div>
      </div>

      {user.can("quotes", "delete") && !isLockedRecord(type, doc.status) && (
        <form action={deleteDocument.bind(null, id)} className="mt-10 border-t border-fp-border pt-6">
          <ConfirmSubmit className={dangerButton} message={`Delete ${docTypes[type].label.toLowerCase()} ${doc.number}? This can't be undone.`}>
            Delete {docTypes[type].label.toLowerCase()}
          </ConfirmSubmit>
        </form>
      )}
    </>
  );
}

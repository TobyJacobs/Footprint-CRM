import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil, Phone, Plus, Star } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, Notice, Select, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { address, gbp, longDate, personName, shortDateTime, statusTone, toLocalInput } from "@/lib/customers/display";
import { activityKinds } from "@/lib/customers/options";
import { createClient } from "@/lib/supabase/server";
import { addActivity, deleteActivity } from "../actions";

export async function generateMetadata(props: PageProps<"/customers/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Customer" };
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "" || (Array.isArray(children) && children.length === 0)) {
    return null;
  }
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-fp-mid">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default async function CustomerPage(props: PageProps<"/customers/[id]">) {
  const user = await requirePermission("customers", "view");
  const canEdit = user.can("customers", "edit");
  const canDelete = user.can("customers", "delete");
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const [{ data: c }, { data: contacts }, { data: plans }, { data: retainers }, { data: activity }, { data: staff }] =
    await Promise.all([
      supabase.from("customers").select("*, parent:parent_id(id, name)").eq("id", id).maybeSingle(),
      supabase.from("contacts").select("*").eq("customer_id", id).order("is_primary", { ascending: false }).order("last_name"),
      supabase.from("hosting_plans").select("*, hosting_items(*)").eq("customer_id", id).order("name"),
      supabase.from("retainers").select("*, retainer_services(*)").eq("customer_id", id).order("name"),
      supabase.from("customer_activity").select("*").eq("customer_id", id).order("occurred_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id, full_name, email"),
    ]);
  if (!c) notFound();

  const staffName = (pid: string | null) => {
    const p = (staff ?? []).find((s) => s.id === pid);
    return p ? (p.full_name ?? p.email) : null;
  };
  const contactName = (cid: string | null) => {
    const p = (contacts ?? []).find((x) => x.id === cid);
    return p ? personName(p) : null;
  };
  const parent = c.parent as { id: string; name: string } | null;

  return (
    <>
      <PageHeader title={c.name} />
      <div className="px-6 py-8 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/customers" className="text-sm font-semibold text-fp-teal-deep hover:underline">
            ← All customers
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {c.status && <Badge tone={statusTone(c.status)}>{c.status}</Badge>}
            {(c.services ?? []).map((s: string) => (
              <Badge key={s}>{s}</Badge>
            ))}
            {canEdit && (
              <Link href={`/customers/${id}/edit`} className={`${secondaryButton} inline-flex items-center gap-2`}>
                <Pencil size={14} aria-hidden /> Edit
              </Link>
            )}
          </div>
        </div>

        <Notice searchParams={searchParams} />

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="grid content-start gap-6">
            <Card title="Details">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Phone">{c.phone && <a href={`tel:${c.phone}`} className="hover:text-fp-pink">{c.phone}</a>}</Detail>
                <Detail label="Email">{c.email && <a href={`mailto:${c.email}`} className="hover:text-fp-pink">{c.email}</a>}</Detail>
                <Detail label="Website">
                  {c.website && (
                    <a
                      href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-fp-pink"
                    >
                      {c.website}
                    </a>
                  )}
                </Detail>
                <Detail label="Type">{c.account_type}</Detail>
                <Detail label="Account owner">{staffName(c.owner_id)}</Detail>
                <Detail label="Parent company">
                  {parent && <Link href={`/customers/${parent.id}`} className="hover:text-fp-pink">{parent.name}</Link>}
                </Detail>
                <Detail label="Industry">{c.industry}</Detail>
                <Detail label="Billing address">
                  {address([c.billing_street, c.billing_city, c.billing_county, c.billing_postcode, c.billing_country])}
                </Detail>
                <Detail label="Shipping address">
                  {address([c.shipping_street, c.shipping_city, c.shipping_county, c.shipping_postcode, c.shipping_country])}
                </Detail>
              </dl>
              {c.description && <p className="mt-4 whitespace-pre-line text-sm text-fp-dark/80">{c.description}</p>}
            </Card>

            <Card
              title="Contacts"
              action={
                canEdit && (
                  <Link href={`/customers/${id}/contacts/new`} className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline">
                    <Plus size={14} aria-hidden /> Add contact
                  </Link>
                )
              }
            >
              <div id="contacts" className="-mt-2" />
              {(contacts ?? []).length === 0 ? (
                <p className="text-sm text-fp-mid">No contacts yet.</p>
              ) : (
                <ul className="divide-y divide-fp-border">
                  {(contacts ?? []).map((p) => (
                    <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div>
                        <p className="flex items-center gap-2 font-semibold">
                          {personName(p)}
                          {p.is_primary && <Star size={14} className="fill-fp-amber text-fp-amber" aria-label="Primary contact" />}
                          {p.financial_status === "ON STOP" && <Badge tone="red">On stop</Badge>}
                          {p.email_opt_out && <Badge>No marketing</Badge>}
                        </p>
                        {(p.job_title || p.department) && (
                          <p className="text-xs text-fp-mid">{[p.job_title, p.department].filter(Boolean).join(", ")}</p>
                        )}
                        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {p.email && (
                            <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 hover:text-fp-pink">
                              <Mail size={13} aria-hidden /> {p.email}
                            </a>
                          )}
                          {(p.phone || p.mobile) && (
                            <a href={`tel:${p.mobile ?? p.phone}`} className="inline-flex items-center gap-1 hover:text-fp-pink">
                              <Phone size={13} aria-hidden /> {p.mobile ?? p.phone}
                            </a>
                          )}
                        </p>
                      </div>
                      {canEdit && (
                        <Link href={`/customers/${id}/contacts/${p.id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
                          Edit
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="Hosting plans"
              action={
                canEdit && (
                  <Link href={`/customers/${id}/hosting/new`} className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline">
                    <Plus size={14} aria-hidden /> Add hosting plan
                  </Link>
                )
              }
            >
              <div id="hosting" className="-mt-2" />
              {(plans ?? []).length === 0 ? (
                <p className="text-sm text-fp-mid">No hosting plans.</p>
              ) : (
                <ul className="divide-y divide-fp-border">
                  {(plans ?? []).map((h) => {
                    const items = (h.hosting_items ?? []) as { id: string; kind: string; plan: string | null; domain: string | null; mailbox_qty: number | null; email_platform: string | null }[];
                    return (
                      <li key={h.id} className="py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="flex items-center gap-2 font-semibold">
                              {h.name}
                              {h.status && <Badge tone={statusTone(h.status)}>{h.status}</Badge>}
                            </p>
                            <p className="text-sm text-fp-dark/75">
                              {[h.plan_type, gbp(h.price) && `${gbp(h.price)}${h.billing_frequency ? ` ${h.billing_frequency.toLowerCase()}` : ""}`, h.renewal_month && `renews ${h.renewal_month}`]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {items.length > 0 && (
                              <p className="mt-1 text-xs text-fp-mid">
                                {items
                                  .map((i) => (i.kind === "web" ? [i.domain, i.plan].filter(Boolean).join(" – ") : `${i.mailbox_qty ?? "?"} mailbox(es) on ${i.email_platform ?? "?"}`))
                                  .join(" · ")}
                              </p>
                            )}
                          </div>
                          {canEdit && (
                            <Link href={`/customers/${id}/hosting/${h.id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
                              Edit
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card
              title="Digital retainers"
              action={
                canEdit && (
                  <Link href={`/customers/${id}/retainers/new`} className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline">
                    <Plus size={14} aria-hidden /> Add retainer
                  </Link>
                )
              }
            >
              <div id="retainers" className="-mt-2" />
              {(retainers ?? []).length === 0 ? (
                <p className="text-sm text-fp-mid">No retainers.</p>
              ) : (
                <ul className="divide-y divide-fp-border">
                  {(retainers ?? []).map((r) => {
                    const svcs = (r.retainer_services ?? []) as { id: string; service: string; qty_per_month: number | null }[];
                    return (
                      <li key={r.id} className="py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="flex items-center gap-2 font-semibold">
                              {r.name}
                              {r.status && <Badge tone={statusTone(r.status)}>{r.status}</Badge>}
                            </p>
                            <p className="text-sm text-fp-dark/75">
                              {[
                                gbp(r.monthly_fee) && `${gbp(r.monthly_fee)} a month`,
                                r.budget_hours && `${r.budget_hours} hours`,
                                staffName(r.digital_am_id) && `Digital AM: ${staffName(r.digital_am_id)}`,
                                staffName(r.sales_am_id) && `Sales AM: ${staffName(r.sales_am_id)}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {svcs.length > 0 && (
                              <p className="mt-1 text-xs text-fp-mid">
                                {svcs.map((s) => (s.qty_per_month ? `${s.service} ×${s.qty_per_month}` : s.service)).join(" · ")}
                              </p>
                            )}
                          </div>
                          {canEdit && (
                            <Link href={`/customers/${id}/retainers/${r.id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
                              Edit
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid content-start gap-6">
            <Card title="Accounts & credit">
              <dl className="grid gap-4">
                <Detail label="Credit status">
                  {c.credit_status && (
                    <Badge tone={/ON STOP|Up Front|before we order/i.test(c.credit_status) ? "red" : "grey"}>{c.credit_status}</Badge>
                  )}
                </Detail>
                <Detail label="Direct Debit – Print & Digital">{c.direct_debit_status}</Detail>
                <Detail label="Direct Debit – Forget Me Not">{c.direct_debit_status_fmn}</Detail>
                <Detail label="Payment terms">
                  {(c.invoice_due_days !== null || c.invoice_due_terms) && [c.invoice_due_days, c.invoice_due_terms].filter((x) => x !== null).join(" ")}
                </Detail>
                <Detail label="Sales discount">{c.sales_discount_percent !== null && `${c.sales_discount_percent}%`}</Detail>
                <Detail label="Default sales account">{c.default_sales_account}</Detail>
                <Detail label="Xero contact ID">{c.xero_contact_id}</Detail>
                <Detail label="Date last ordered">{longDate(c.date_last_ordered)}</Detail>
              </dl>
            </Card>

            <Card title="Sales & marketing">
              <dl className="grid gap-4">
                <Detail label="Heard about us">{(c.heard_about_us ?? []).join(", ")}</Detail>
                <Detail label="Brochures sent">{(c.brochures_sent ?? []).join(", ")}</Detail>
                <Detail label="Last contacted">{longDate(c.last_contacted_on)}</Detail>
                <Detail label="Follow up">{shortDateTime(c.follow_up_at)}</Detail>
              </dl>
            </Card>

            <Card title="Timeline">
              <div id="timeline" className="-mt-2" />
              {canEdit && (
                <form action={addActivity.bind(null, id)} className="mb-5 grid gap-2">
                  <textarea name="body" rows={3} required placeholder="Add a note, call or meeting…" className={inputClass} />
                  <div className="grid grid-cols-2 gap-2">
                    <Select name="kind" options={activityKinds} defaultValue="note" blank={false} />
                    <Select
                      name="contact_id"
                      options={(contacts ?? []).map((p) => ({ value: p.id, label: personName(p) }))}
                      blank="No contact"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      name="occurred_at"
                      defaultValue={toLocalInput(new Date().toISOString())}
                      className={inputClass}
                      aria-label="When"
                    />
                    <button type="submit" className={primaryButton}>
                      Add
                    </button>
                  </div>
                </form>
              )}
              {(activity ?? []).length === 0 ? (
                <p className="text-sm text-fp-mid">Nothing recorded yet.</p>
              ) : (
                <ol className="grid gap-4">
                  {(activity ?? []).map((a) => (
                    <li key={a.id} className="border-l-2 border-fp-pink/40 pl-3">
                      <p className="text-xs text-fp-mid">
                        {activityKinds.find((k) => k.value === a.kind)?.label ?? a.kind} · {shortDateTime(a.occurred_at)}
                        {staffName(a.created_by) && ` · ${staffName(a.created_by)}`}
                        {contactName(a.contact_id) && ` · with ${contactName(a.contact_id)}`}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm">{a.body}</p>
                      {canDelete && (
                        <form action={deleteActivity.bind(null, id, a.id)}>
                          <ConfirmSubmit message="Delete this timeline entry?" className="mt-1 text-xs text-fp-mid hover:text-fp-error">
                            Delete
                          </ConfirmSubmit>
                        </form>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

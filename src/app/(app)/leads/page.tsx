import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { money } from "@/components/dashboards/parts";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Notice, dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { leadSources } from "@/lib/customers/options";
import { ukToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { deleteLead, quoteFromLead, saveLead } from "./actions";
import { LeadCard, LeadDrag, StageColumn } from "./LeadDrag";

export const metadata: Metadata = { title: "Lead pipelines" };

type Stage = { id: string; pipeline_id: string; name: string; position: number; kind: "open" | "won" | "lost" };
type Lead = {
  id: string;
  pipeline_id: string;
  stage_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  value_estimate: number | null;
  owner_id: string | null;
  next_follow_up: string | null;
  notes: string | null;
  lost_reason: string | null;
  customer_id: string | null;
  stage_changed_at: string;
};

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// Leads before they're quotes, one board per business area. Marketing brings
// them in, Sales works them; "Make quote" turns one into a customer and quote.
export default async function LeadsBoard(props: PageProps<"/leads">) {
  const user = await getCurrentUser();
  if (!user.can("marketing", "view") && !user.can("quotes", "view")) return <NoAccess title="Lead pipelines" />;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: pipelines }, { data: stages }, { data: people }] = await Promise.all([
    supabase.from("lead_pipelines").select("id, name, business_unit").eq("active", true).order("position"),
    supabase.from("lead_stages").select("*").order("position"),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
  ]);
  const pipeline = (pipelines ?? []).find((p) => p.id === sp.p) ?? pipelines?.[0];
  if (!pipeline) return <NoAccess title="Lead pipelines" />;
  const { data: leadRows } = await supabase.from("leads").select("*").eq("pipeline_id", pipeline.id).order("stage_changed_at", { ascending: false });
  const leads = (leadRows ?? []) as Lead[];
  const myStages = ((stages ?? []) as Stage[]).filter((s) => s.pipeline_id === pipeline.id);
  const canEdit = user.can("marketing", "edit") || user.can("quotes", "edit");
  const canQuote = user.can("customers", "edit") && user.can("quotes", "edit");
  const here = `/leads?p=${pipeline.id}`;
  const today = ukToday();
  const nameOf = (id: string | null) => (people ?? []).find((p) => p.id === id)?.full_name ?? (people ?? []).find((p) => p.id === id)?.email ?? null;
  const open = typeof sp.open === "string" ? leads.find((l) => l.id === sp.open) : undefined;
  const adding = sp.add === "1" && canEdit;
  const openTotal = leads.filter((l) => myStages.find((s) => s.id === l.stage_id)?.kind === "open").reduce((s, l) => s + Number(l.value_estimate ?? 0), 0);

  const fields = (l?: Lead) => (
    <>
      <input type="hidden" name="pipeline_id" value={pipeline.id} />
      <label className="grid gap-1">
        <span className="font-semibold">Name</span>
        <input name="name" required maxLength={200} defaultValue={l?.name ?? ""} placeholder="The person" className={inputClass} />
      </label>
      <label className="grid gap-1">
        <span className="font-semibold">Business</span>
        <input name="company" maxLength={200} defaultValue={l?.company ?? ""} className={inputClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="font-semibold">Email</span>
          <input name="email" type="email" maxLength={320} defaultValue={l?.email ?? ""} className={inputClass} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Phone</span>
          <input name="phone" maxLength={50} defaultValue={l?.phone ?? ""} className={inputClass} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Stage</span>
          <select name="stage_id" defaultValue={l?.stage_id ?? myStages[0]?.id} className={inputClass}>
            {myStages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Worth about £</span>
          <input name="value_estimate" type="number" min={0} step="0.01" defaultValue={l?.value_estimate ?? ""} className={inputClass} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Where from</span>
          <select name="source" defaultValue={l?.source ?? ""} className={inputClass}>
            <option value="">—</option>
            {leadSources.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Owner</span>
          <select name="owner_id" defaultValue={l ? (l.owner_id ?? "") : user.id} className={inputClass}>
            <option value="">Nobody yet</option>
            {(people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Next follow-up</span>
          <input name="next_follow_up" type="date" defaultValue={l?.next_follow_up ?? ""} className={inputClass} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">If lost, why</span>
          <input name="lost_reason" maxLength={200} defaultValue={l?.lost_reason ?? ""} className={inputClass} />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="font-semibold">Notes</span>
        <textarea name="notes" rows={4} maxLength={5000} defaultValue={l?.notes ?? ""} className={inputClass} />
      </label>
    </>
  );

  return (
    <>
      <PageHeader title="Lead pipelines" intro="Leads before they're quotes, one board per business area. Drag a card to move it on; Make quote turns it into a customer and quote." />
      <div className="grid gap-4 px-4 py-6 sm:px-6 lg:px-10">
        <Notice searchParams={sp} />
        <div className="flex flex-wrap items-center gap-2">
          {(pipelines ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/leads?p=${p.id}`}
              aria-current={p.id === pipeline.id ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${p.id === pipeline.id ? "border-fp-black bg-fp-black text-white" : "border-fp-border bg-white hover:border-fp-pink"}`}
            >
              {p.name}
            </Link>
          ))}
          <span className="text-sm text-fp-dark/75">· {money(openTotal)} in open leads</span>
          <span className="ml-auto flex gap-2">
            {user.can("marketing", "edit") && (
              <Link href="/leads/settings" className={secondaryButton}>
                Stages
              </Link>
            )}
            {canEdit && (
              <Link href={`${here}&add=1`} scroll={false} className={primaryButton}>
                Add lead
              </Link>
            )}
          </span>
        </div>

        <LeadDrag back={here}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {myStages.map((s) => {
              const list = leads.filter((l) => l.stage_id === s.id);
              const worth = list.reduce((t, l) => t + Number(l.value_estimate ?? 0), 0);
              return (
                <StageColumn
                  key={s.id}
                  stage={s.id}
                  className={`flex w-64 shrink-0 flex-col gap-2 rounded-lg p-2 ${s.kind === "won" ? "bg-fp-teal/10" : s.kind === "lost" ? "bg-fp-light" : "bg-fp-offwhite"}`}
                >
                  <h2 className="flex items-baseline justify-between px-1 text-sm font-bold">
                    {s.name}
                    <span className="text-xs font-normal text-fp-mid">
                      {list.length}
                      {worth ? ` · ${money(worth)}` : ""}
                    </span>
                  </h2>
                  {list.map((l) => {
                    const due = l.next_follow_up && l.next_follow_up <= today && s.kind === "open";
                    return (
                      <LeadCard key={l.id} id={l.id} stage={s.id} canDrag={canEdit}>
                        <Link
                          href={`${here}&open=${l.id}`}
                          scroll={false}
                          draggable={false}
                          className="block rounded-md border border-fp-border bg-white p-2.5 text-sm hover:border-fp-pink"
                        >
                          <p className="font-semibold">{l.company || l.name}</p>
                          {l.company && <p className="text-xs text-fp-dark/75">{l.name}</p>}
                          <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-fp-mid">
                            {l.value_estimate ? <span className="font-semibold text-fp-black">{money(Number(l.value_estimate))}</span> : null}
                            {nameOf(l.owner_id) && <span>{nameOf(l.owner_id)}</span>}
                            {l.next_follow_up && <span className={due ? "font-bold text-fp-error" : ""}>Follow up {day(l.next_follow_up)}</span>}
                            {l.customer_id && <span className="text-fp-teal-deep">Customer</span>}
                          </p>
                        </Link>
                      </LeadCard>
                    );
                  })}
                </StageColumn>
              );
            })}
          </div>
        </LeadDrag>
        <p className="text-xs text-fp-mid">
          Leads hold personal details: delete a lead when it&apos;s no longer needed (UK GDPR). Follow-up dates due today or earlier show in red.
        </p>
      </div>

      {(open || adding) && (
        <aside
          aria-label={open ? open.name : "Add a lead"}
          className="fixed inset-0 z-40 overflow-y-auto bg-white p-5 shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[30rem] sm:border-l sm:border-fp-border"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="text-lg font-black">{open ? open.company || open.name : `Add a lead to ${pipeline.name}`}</h2>
            <Link href={here} aria-label="Close" className="rounded-md p-1 hover:bg-fp-light">
              <X size={18} aria-hidden />
            </Link>
          </div>
          {open && (
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              {canQuote && (
                <form action={quoteFromLead.bind(null, open.id)}>
                  <input type="hidden" name="back" value={`${here}&open=${open.id}`} />
                  <button type="submit" className={primaryButton}>
                    {open.customer_id ? "Make another quote" : "Make customer and quote"}
                  </button>
                </form>
              )}
              {open.customer_id && (
                <Link href={`/customers/${open.customer_id}`} className={secondaryButton}>
                  Open customer
                </Link>
              )}
            </div>
          )}
          {canEdit ? (
            <form action={saveLead.bind(null, open?.id ?? null)} className="grid gap-3 text-sm">
              <input type="hidden" name="back" value={open ? `${here}&open=${open.id}` : `${here}&add=1`} />
              {fields(open)}
              <button type="submit" className={`${primaryButton} justify-self-start`}>
                {open ? "Save" : "Add lead"}
              </button>
            </form>
          ) : (
            open && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-fp-mid">Name</dt>
                <dd>{open.name}</dd>
                <dt className="text-fp-mid">Email</dt>
                <dd>{open.email ?? "—"}</dd>
                <dt className="text-fp-mid">Phone</dt>
                <dd>{open.phone ?? "—"}</dd>
                <dt className="text-fp-mid">Notes</dt>
                <dd className="whitespace-pre-wrap">{open.notes ?? "—"}</dd>
              </dl>
            )
          )}
          {open && canEdit && (
            <details className="mt-6 border-t border-fp-border pt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-fp-error">Delete this lead…</summary>
              <form action={deleteLead.bind(null, open.id)} className="mt-2 grid gap-2">
                <input type="hidden" name="back" value={here} />
                <p>Delete this lead and its details? It can&apos;t be undone (it stays in the audit log).</p>
                <button type="submit" className={`${dangerButton} justify-self-start`}>
                  Yes, delete it
                </button>
              </form>
            </details>
          )}
        </aside>
      )}
    </>
  );
}

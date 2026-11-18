import type { Metadata } from "next";
import Link from "next/link";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import CopyButton from "@/components/CopyButton";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, Notice, dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { addDaysTo, ukToday } from "@/lib/dates";
import { embedCode } from "@/lib/lead-forms";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { deleteLeadForm, saveLeadForm } from "../actions";

export const metadata: Metadata = { title: "Website forms" };

type LeadForm = {
  id: string;
  public_id: string;
  name: string;
  pipeline_id: string;
  owner_id: string | null;
  notify_ids: string[];
  heading: string | null;
  intro: string | null;
  button_label: string;
  thank_you: string;
  show_phone: boolean;
  show_company: boolean;
  show_message: boolean;
  privacy_url: string | null;
  active: boolean;
};

// Enquiry forms for Footprint's own websites (Marketing edit). Each enquiry
// becomes a lead in the form's pipeline and emails the people chosen here.
export default async function LeadForms(props: PageProps<"/leads/forms">) {
  const user = await getCurrentUser();
  if (!user.can("marketing", "edit")) return <NoAccess title="Website forms" />;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const since = addDaysTo(ukToday(), -30);
  const [{ data: formRows }, { data: pipelines }, { data: people }, { data: recent }] = await Promise.all([
    supabase.from("lead_forms").select("*").order("created_at"),
    supabase.from("lead_pipelines").select("id, name").eq("active", true).order("position"),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase.from("lead_form_submissions").select("form_id").gte("created_at", since),
  ]);
  const forms = (formRows ?? []) as LeadForm[];
  const site = await siteUrl();
  const adding = sp.add === "1" || forms.length === 0;
  const pipelineName = (id: string) => (pipelines ?? []).find((p) => p.id === id)?.name ?? "—";
  const personName = (id: string | null) => {
    const p = (people ?? []).find((x) => x.id === id);
    return p ? (p.full_name ?? p.email) : null;
  };
  const countFor = (id: string) => (recent ?? []).filter((r) => r.form_id === id).length;

  const fields = (f?: LeadForm) => (
    <div className="grid gap-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="font-semibold">Form name (staff only)</span>
          <input name="name" required maxLength={100} defaultValue={f?.name ?? ""} placeholder="e.g. Footprint contact page" className={inputClass} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Leads go into</span>
          <select name="pipeline_id" required defaultValue={f?.pipeline_id ?? pipelines?.[0]?.id} className={inputClass}>
            {(pipelines ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} pipeline
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Lead owner</span>
          <select name="owner_id" defaultValue={f?.owner_id ?? ""} className={inputClass}>
            <option value="">Nobody yet</option>
            {(people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Privacy policy link (optional)</span>
          <input name="privacy_url" type="url" maxLength={300} defaultValue={f?.privacy_url ?? ""} placeholder="https://…" className={inputClass} />
        </label>
      </div>
      <details className="rounded-md border border-fp-border p-3" open={!f}>
        <summary className="cursor-pointer font-semibold">Who to email about each enquiry</summary>
        <p className="mt-1 text-xs text-fp-mid">The lead owner is always emailed. Tick anyone else who should be told.</p>
        <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
          {(people ?? []).map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input type="checkbox" name="notify_ids" value={p.id} defaultChecked={f?.notify_ids.includes(p.id) ?? false} className="accent-fp-pink" />
              {p.full_name ?? p.email}
            </label>
          ))}
        </div>
      </details>
      <label className="grid gap-1">
        <span className="font-semibold">Heading on the form (optional)</span>
        <input name="heading" maxLength={200} defaultValue={f?.heading ?? ""} placeholder="e.g. Get in touch" className={inputClass} />
      </label>
      <label className="grid gap-1">
        <span className="font-semibold">Words above the form (optional)</span>
        <textarea name="intro" rows={2} maxLength={1000} defaultValue={f?.intro ?? ""} className={inputClass} />
      </label>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <span className="font-semibold">Ask for:</span>
        <span className="text-fp-mid">Name and email (always)</span>
        {(
          [
            ["show_phone", "Phone"],
            ["show_company", "Business"],
            ["show_message", "Message"],
          ] as const
        ).map(([name, label]) => (
          <label key={name} className="flex items-center gap-2">
            <input type="checkbox" name={name} defaultChecked={f ? f[name] : true} className="accent-fp-pink" />
            {label}
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <label className="grid gap-1">
          <span className="font-semibold">Button</span>
          <input name="button_label" required maxLength={40} defaultValue={f?.button_label ?? "Send"} className={inputClass} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Thank-you message</span>
          <input name="thank_you" required maxLength={500} defaultValue={f?.thank_you ?? "Thanks for getting in touch. We'll be back to you soon."} className={inputClass} />
        </label>
      </div>
      {f && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={f.active} className="accent-fp-pink" />
          Taking enquiries (untick to switch the form off)
        </label>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Website forms"
        intro="Enquiry forms for Footprint's own websites, in place of the GoHighLevel forms. Each enquiry becomes a lead and emails the people you choose."
      />
      <div className="grid max-w-4xl gap-5 px-4 py-6 sm:px-6 lg:px-10">
        <Link href="/leads" className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Lead pipelines
        </Link>
        <Notice searchParams={sp} />
        {forms.map((f) => {
          const open = sp.open === f.id;
          const link = `${site}/f/${f.public_id}`;
          return (
            <Card
              key={f.id}
              title={f.name}
              action={
                <span className="flex items-center gap-2 text-sm">
                  {f.active ? <Badge tone="teal">Taking enquiries</Badge> : <Badge>Switched off</Badge>}
                  <Link href={open ? "/leads/forms" : `/leads/forms?open=${f.id}`} scroll={false} className={secondaryButton}>
                    {open ? "Close" : "Change"}
                  </Link>
                </span>
              }
            >
              <p className="text-sm text-fp-dark/80">
                Into the <strong>{pipelineName(f.pipeline_id)}</strong> pipeline · owner {personName(f.owner_id) ?? "nobody yet"} · emails{" "}
                {[f.owner_id, ...f.notify_ids].filter((v, i, a) => v && a.indexOf(v) === i).map(personName).filter(Boolean).join(", ") || "nobody (choose someone below)"} ·{" "}
                {countFor(f.id)} enquiries in the last 30 days
              </p>
              <div className="mt-4 grid gap-2 text-sm">
                <p className="font-semibold">Put it on a website</p>
                <p className="text-fp-mid">Paste this where the form should appear (in place of the GoHighLevel form code). It works on footprintgroup.uk and forgetmenotonline.org.</p>
                <textarea readOnly rows={4} value={embedCode(site, f.public_id)} aria-label="Code for the website" className={`${inputClass} font-mono text-xs`} />
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton text={embedCode(site, f.public_id)} label="Copy website code" />
                  <CopyButton text={link} label="Copy link" />
                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-fp-teal-deep hover:underline">
                    Open the form ↗
                  </a>
                </div>
              </div>
              {open && (
                <div className="mt-5 grid gap-4 border-t border-fp-border pt-5">
                  <form action={saveLeadForm.bind(null, f.id)} className="grid gap-4">
                    {fields(f)}
                    <div>
                      <button type="submit" className={primaryButton}>
                        Save form
                      </button>
                    </div>
                  </form>
                  <form action={deleteLeadForm.bind(null, f.id)}>
                    <ConfirmSubmit message={`Delete "${f.name}"? Websites using it will stop taking enquiries. Leads it brought in stay.`} className={dangerButton}>
                      Delete form
                    </ConfirmSubmit>
                  </form>
                </div>
              )}
            </Card>
          );
        })}
        {adding ? (
          <Card title="New website form">
            <form action={saveLeadForm.bind(null, null)} className="grid gap-4">
              {fields()}
              <div className="flex gap-2">
                <button type="submit" className={primaryButton}>
                  Create form
                </button>
                {forms.length > 0 && (
                  <Link href="/leads/forms" className={secondaryButton}>
                    Cancel
                  </Link>
                )}
              </div>
            </form>
          </Card>
        ) : (
          <div>
            <Link href="/leads/forms?add=1" scroll={false} className={primaryButton}>
              New website form
            </Link>
          </div>
        )}
        <p className="text-xs text-fp-mid">
          Spam protection is built in: a hidden trap for bots, and limits of 3 enquiries an hour per email address and 10 per connection. If someone with an open lead in the same pipeline sends another enquiry, it&apos;s added to their lead rather than making a new one.
        </p>
      </div>
    </>
  );
}

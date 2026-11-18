import { Trash2 } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Badge, Card, Field, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteEmailTemplate, saveEmailTemplate } from "../actions";

// Emails staff can draft from a customer's page. Admins write them here.
export default async function EmailTemplatesPage(props: PageProps<"/admin/email-templates">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: templates } = await supabase.from("email_templates").select("*").order("position").order("name");

  const fields = (t?: { name: string; subject: string; body: string; active: boolean }) => (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Template name">
          <input name="name" required defaultValue={t?.name ?? ""} className={inputClass} placeholder="e.g. Setting up a Direct Debit" />
        </Field>
        <Field label="Subject">
          <input name="subject" required defaultValue={t?.subject ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="Message">
        <textarea name="body" required rows={10} defaultValue={t?.body ?? ""} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={t ? t.active : true} className="accent-fp-pink" />
        Available to staff
      </label>
    </div>
  );

  return (
    <div className="grid max-w-4xl gap-6">
      <Notice searchParams={sp} />
      <Card title="About email templates">
        <p className="text-sm text-fp-dark/75">
          Staff pick a template on a customer&apos;s page, read it through, edit anything, then send. These words are filled in
          automatically: <code>{"{{first_name}}"}</code> (the contact&apos;s first name), <code>{"{{company_name}}"}</code> (the
          customer), <code>{"{{sender_name}}"}</code> (whoever is sending) and <code>{"{{our_company}}"}</code> (Footprint).
        </p>
      </Card>

      {(templates ?? []).map((t) => (
        <details key={t.id} className="rounded-lg border border-fp-border bg-white">
          <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 font-bold">
            <span>
              {t.name} {!t.active && <Badge>Hidden</Badge>}
            </span>
            <span className="text-sm font-normal text-fp-mid">{t.subject}</span>
          </summary>
          <div className="border-t border-fp-border p-4">
            <form action={saveEmailTemplate.bind(null, t.id)} className="grid gap-3">
              {fields(t)}
              <div className="flex flex-wrap gap-3">
                <button type="submit" className={primaryButton}>Save template</button>
              </div>
            </form>
            <form action={deleteEmailTemplate.bind(null, t.id)} className="mt-3">
              <ConfirmSubmit className="inline-flex items-center gap-1 text-xs font-semibold text-fp-error hover:underline" message={`Delete the template "${t.name}"?`}>
                <Trash2 size={12} aria-hidden /> Delete template
              </ConfirmSubmit>
            </form>
          </div>
        </details>
      ))}

      <Card title="Add a template">
        <form action={saveEmailTemplate.bind(null, null)} className="grid gap-3">
          {fields()}
          <div>
            <button type="submit" className={secondaryButton}>Add template</button>
          </div>
        </form>
      </Card>
    </div>
  );
}

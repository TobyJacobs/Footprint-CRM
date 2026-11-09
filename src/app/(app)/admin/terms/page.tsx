import { Trash2 } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Badge, Card, Field, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { termsTargets } from "@/lib/sales/terms-presets";
import { createClient } from "@/lib/supabase/server";
import { deleteTermsPreset, saveTermsPreset } from "../actions";

// Terms presets (DJ, 9 November 2026): named terms staff pick on the Terms box
// of quotes, proposals, orders and invoices. Admins write them here.
export default async function TermsPresetsPage(props: PageProps<"/admin/terms">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: presets } = await supabase.from("terms_presets").select("*").order("position").order("name");
  const where = (list: string[]) => termsTargets.filter((t) => list.includes(t.value)).map((t) => t.label).join(", ");

  const fields = (p?: { name: string; body: string; applies_to: string[]; active: boolean }) => (
    <div className="grid gap-3">
      <Field label="Preset name">
        <input name="name" required maxLength={100} defaultValue={p?.name ?? ""} className={inputClass} placeholder="e.g. Website build terms" />
      </Field>
      <div className="grid gap-1 text-sm">
        <span className="font-semibold">Offered on</span>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {termsTargets.map((t) => (
            <label key={t.value} className="flex items-center gap-2">
              <input type="checkbox" name="applies_to" value={t.value} defaultChecked={p ? p.applies_to.includes(t.value) : true} className="accent-fp-pink" />
              {t.label}
            </label>
          ))}
        </div>
      </div>
      <Field label="Terms">
        <textarea name="body" required rows={10} maxLength={20000} defaultValue={p?.body ?? ""} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={p ? p.active : true} className="accent-fp-pink" />
        Available to staff
      </label>
    </div>
  );

  return (
    <div className="grid max-w-4xl gap-6">
      <Notice searchParams={sp} />
      <Card title="About terms presets">
        <p className="text-sm text-fp-dark/75">
          Staff pick a preset from the <strong>Use preset…</strong> list above the Terms box on a quote, proposal, order or invoice. It fills the box, and they
          can still edit it for that customer. Each preset is only offered on the documents you tick.
        </p>
      </Card>

      {(presets ?? []).map((p) => (
        <details key={p.id} className="rounded-lg border border-fp-border bg-white">
          <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 font-bold">
            <span>
              {p.name} {!p.active && <Badge>Hidden</Badge>}
            </span>
            <span className="text-sm font-normal text-fp-mid">{where(p.applies_to)}</span>
          </summary>
          <div className="border-t border-fp-border p-4">
            <form action={saveTermsPreset.bind(null, p.id)} className="grid gap-3">
              {fields(p)}
              <div>
                <button type="submit" className={primaryButton}>
                  Save preset
                </button>
              </div>
            </form>
            <form action={deleteTermsPreset.bind(null, p.id)} className="mt-3">
              <ConfirmSubmit className="inline-flex items-center gap-1 text-xs font-semibold text-fp-error hover:underline" message={`Delete the preset "${p.name}"? Documents that already use its words keep them.`}>
                <Trash2 size={12} aria-hidden /> Delete preset
              </ConfirmSubmit>
            </form>
          </div>
        </details>
      ))}

      <Card title="Add a preset">
        <form action={saveTermsPreset.bind(null, null)} className="grid gap-3">
          {fields()}
          <div>
            <button type="submit" className={secondaryButton}>
              Add preset
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

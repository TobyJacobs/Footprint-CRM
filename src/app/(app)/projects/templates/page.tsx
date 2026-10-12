import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Badge, Card, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { projectGroups } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { addTemplateTask, deleteTemplateTask, saveTemplate } from "../actions";

export const metadata: Metadata = { title: "Project templates" };

// The standard stages and steps for each kind of job. A new sales order gets a
// project from the template matching its business unit (or the default one).
export default async function TemplatesPage(props: PageProps<"/projects/templates">) {
  const user = await getCurrentUser();
  const canEdit = user.can("projects", "edit");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: templates }, { data: steps }] = await Promise.all([
    supabase.from("project_templates").select("*").order("name"),
    supabase.from("project_template_tasks").select("*").order("position"),
  ]);

  return (
    <div className="grid max-w-4xl gap-6">
      <Notice searchParams={sp} />
      <Card title="About templates">
        <p className="text-sm text-fp-dark/75">
          Every new sales order automatically gets a project. Its tasks are copied from the template whose <strong>business unit</strong> matches
          the order, or from the <strong>default</strong> template. Changes here only affect projects created from now on.
        </p>
      </Card>

      {(templates ?? []).map((t) => {
        const mine = (steps ?? []).filter((s) => s.template_id === t.id);
        return (
          <details key={t.id} className="rounded-lg border border-fp-border bg-white">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 font-bold">
              <span className="flex flex-wrap items-center gap-2">
                {t.name}
                {t.is_default && <Badge tone="teal">Default</Badge>}
                {!t.active && <Badge>Hidden</Badge>}
              </span>
              <span className="text-sm font-normal text-fp-mid">
                {t.project_group ?? "No group"} · {mine.length} steps
              </span>
            </summary>
            <div className="grid gap-5 border-t border-fp-border p-4">
              {mine.length > 0 && (
                <ol className="grid gap-1 text-sm">
                  {mine.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="text-fp-mid">{s.stage} ·</span> {s.title}
                        {s.due_offset_days !== null && <span className="text-fp-dark/70"> (due day {s.due_offset_days})</span>}
                      </span>
                      {canEdit && (
                        <form action={deleteTemplateTask.bind(null, s.id)}>
                          <ConfirmSubmit className="inline-flex items-center gap-1 text-xs font-semibold text-fp-error hover:underline" message={`Remove the step "${s.title}"?`}>
                            <Trash2 size={12} aria-hidden /> Remove
                          </ConfirmSubmit>
                        </form>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {canEdit && (
                <>
                  <form action={addTemplateTask.bind(null, t.id)} className="grid gap-3 border-t border-fp-border pt-4 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end">
                    <label className="grid gap-1 text-sm">
                      <span className="font-semibold">Add a step</span>
                      <input name="title" required className={inputClass} placeholder="e.g. Proof approved" />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-semibold">Stage</span>
                      <input name="stage" list={`stages-${t.id}`} className={inputClass} placeholder="General" />
                      <datalist id={`stages-${t.id}`}>
                        {[...new Set(mine.map((s) => s.stage))].map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-semibold">Due after (days)</span>
                      <input name="due_offset_days" type="number" min="0" className={inputClass} />
                    </label>
                    <button type="submit" className={secondaryButton}>
                      Add
                    </button>
                  </form>
                  <form action={saveTemplate.bind(null, t.id)} className="grid gap-3 border-t border-fp-border pt-4 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      <span className="font-semibold">Template name</span>
                      <input name="name" required defaultValue={t.name} className={inputClass} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-semibold">Group</span>
                      <select name="project_group" defaultValue={t.project_group ?? ""} className={inputClass}>
                        <option value="">—</option>
                        {projectGroups.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-semibold">Business unit it applies to</span>
                      <input name="business_unit" defaultValue={t.business_unit ?? ""} className={inputClass} placeholder="e.g. Print" />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-semibold">Description</span>
                      <input name="description" defaultValue={t.description ?? ""} className={inputClass} />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="is_default" defaultChecked={t.is_default} className="accent-fp-pink" /> Default template
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="active" defaultChecked={t.active} className="accent-fp-pink" /> Available
                    </label>
                    <div className="sm:col-span-2">
                      <button type="submit" className={primaryButton}>
                        Save template
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

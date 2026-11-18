import { Field, inputClass, primaryButton } from "@/components/ui";
import { BOT_SKILLS, defaultModel, engineLabel, type BotEngine } from "@/lib/ai/bot-tools";

export type BotValues = {
  name?: string;
  engine?: string;
  model?: string | null;
  skills?: string[];
  instructions?: string | null;
  ai_project_id?: string | null;
  active?: boolean;
};

// Add or change a bot (admins).
export default function BotForm({
  action,
  values = {},
  agents,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  values?: BotValues;
  agents: { id: string; title: string }[];
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <input name="name" required maxLength={80} defaultValue={values.name ?? ""} className={inputClass} />
      </Field>
      <Field label="Engine" hint="Claude and Grok bots run inside FootprintOS. An outside bot connects in with its own key.">
        <select name="engine" defaultValue={values.engine ?? "claude"} className={inputClass}>
          {(Object.keys(engineLabel) as BotEngine[]).map((e) => (
            <option key={e} value={e}>
              {engineLabel[e]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Model (Claude and Grok bots)" hint={`Leave blank for the usual one: ${defaultModel.claude} for Claude, ${defaultModel.grok} for Grok.`}>
        <input name="model" maxLength={80} defaultValue={values.model ?? ""} className={inputClass} />
      </Field>
      <Field label="FootprintAI agent it belongs to">
        <select name="ai_project_id" defaultValue={values.ai_project_id ?? ""} className={inputClass}>
          <option value="">—</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="grid gap-2 text-sm sm:col-span-2">
        <legend className="mb-1 font-semibold">What it&apos;s allowed to do</legend>
        {BOT_SKILLS.map((s) => (
          <label key={s.key} className="flex items-start gap-2">
            <input type="checkbox" name="skills" value={s.key} defaultChecked={values.skills?.includes(s.key) ?? true} className="mt-1" />
            <span>
              <span className="font-semibold">{s.label}</span> <span className="text-fp-mid">· {s.hint} (drafts only)</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field label="Extra instructions (Claude and Grok bots)" hint="Anything this bot should always do, e.g. 'Always quote in boxes of 250'." wide>
        <textarea name="instructions" rows={4} maxLength={4000} defaultValue={values.instructions ?? ""} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={values.active ?? true} /> Switched on
      </label>
      <div className="sm:col-span-2">
        <button className={primaryButton}>{submitLabel}</button>
      </div>
    </form>
  );
}

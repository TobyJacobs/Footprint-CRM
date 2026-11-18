import { Field, inputClass, primaryButton } from "@/components/ui";
import { BOT_SKILLS, companyKey, defaultModel, engineLabel, keyPrefix, type BotEngine } from "@/lib/ai/bot-tools";

export type BotValues = {
  name?: string;
  description?: string | null;
  webhook_url?: string | null;
  engine?: string;
  model?: string | null;
  key_name?: string | null;
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
  canQuote,
  isAdmin = false,
}: {
  action: (fd: FormData) => Promise<void>;
  values?: BotValues;
  agents: { id: string; title: string }[];
  submitLabel: string;
  canQuote: boolean;
  isAdmin?: boolean;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <input name="name" required maxLength={80} defaultValue={values.name ?? ""} className={inputClass} />
      </Field>
      <Field label="Engine" hint="Claude and Grok bots run inside FootprintOS with your instructions. An outside bot lives somewhere else and connects with its own key and web address.">
        <select name="engine" defaultValue={values.engine ?? "claude"} className={inputClass}>
          {(Object.keys(engineLabel) as BotEngine[]).map((e) => (
            <option key={e} value={e}>
              {engineLabel[e]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="What it's for" hint="One line, shown to everyone, e.g. 'Jack's account manager: knows our customers and follow-ups'." wide>
        <input name="description" maxLength={300} defaultValue={values.description ?? ""} className={inputClass} />
      </Field>
      <Field
        label="Web address (outside bots)"
        hint="Optional. If your bot has its own https address, FootprintOS sends it requests and group chats there, so everyone can use it here."
        wide
      >
        <input name="webhook_url" type="url" maxLength={500} placeholder="https://" defaultValue={values.webhook_url ?? ""} className={inputClass} />
      </Field>
      <Field label="Model (Claude and Grok bots)" hint={`Leave blank for the usual one: ${defaultModel.claude} for Claude, ${defaultModel.grok} for Grok.`}>
        <input name="model" maxLength={80} defaultValue={values.model ?? ""} className={inputClass} />
      </Field>
      <Field
        label="Its own AI key (Claude and Grok bots)"
        hint={`So its costs go to its owner's AI account. Put the key in Netlify under a name starting ${keyPrefix.claude} (Claude) or ${keyPrefix.grok} (Grok), e.g. ${keyPrefix.grok}JACK, then type that name here. Leave blank to use the company key (${companyKey.claude} / ${companyKey.grok}).${isAdmin ? "" : " Only an admin can change this."}`}
        wide
      >
        <input
          name="key_name"
          maxLength={60}
          pattern="(ANTHROPIC|XAI)_API_KEY_[A-Z0-9_]{1,30}"
          placeholder={`${keyPrefix.grok}JACK`}
          defaultValue={values.key_name ?? ""}
          readOnly={!isAdmin}
          className={`${inputClass} font-mono ${isAdmin ? "" : "bg-fp-offwhite"}`}
        />
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
            <input
              type="checkbox"
              name="skills"
              value={s.key}
              defaultChecked={values.skills?.includes(s.key) ?? false}
              disabled={!canQuote && !values.skills?.includes(s.key)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">{s.label}</span> <span className="text-fp-mid">
                · {s.hint} (drafts only){canQuote ? "" : ". Only people who can make quotes can switch this on."}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field
        label="Instructions (Claude and Grok bots)"
        hint="Who the bot is and how it should work. To bring over a bot you already use in Claude or Grok, paste its instructions here."
        wide
      >
        <textarea name="instructions" rows={6} maxLength={4000} defaultValue={values.instructions ?? ""} className={inputClass} />
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

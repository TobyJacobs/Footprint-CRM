import { Field, Select, TextArea, TextInput, primaryButton } from "@/components/ui";
import { aiDecisions, aiKinds, aiStages } from "@/lib/ai/options";
import type { AiProject } from "@/lib/ai/data";

export default function ProjectForm({
  action,
  people,
  values = {},
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  people: { id: string; name: string }[];
  values?: Partial<AiProject>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4">
      <Field label="Name" hint="e.g. “Account management agent” or “SSL renewal notifications”">
        <TextInput name="title" required defaultValue={values.title} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type">
          <Select name="kind" options={aiKinds} defaultValue={values.kind ?? "agent"} blank={false} />
        </Field>
        <Field label="Owner" hint="Runs the pilot and signs off results.">
          <Select name="owner_id" options={people.map((p) => ({ value: p.id, label: p.name }))} defaultValue={values.owner_id} blank="Not chosen yet" />
        </Field>
        <Field label="Testing wave" hint="e.g. Wave 1">
          <TextInput name="wave" defaultValue={values.wave} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Stage">
          <Select name="stage" options={aiStages} defaultValue={values.stage ?? "planned"} blank={false} />
        </Field>
        <Field label="Decision after testing">
          <Select name="decision" options={aiDecisions} defaultValue={values.decision} blank="Not decided yet" />
        </Field>
      </div>
      <Field label="Summary">
        <TextArea name="summary" rows={3} defaultValue={values.summary} />
      </Field>
      <Field label="First pilot job" hint="What it does on our own work first.">
        <TextArea name="pilot_job" rows={2} defaultValue={values.pilot_job} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Main tools">
          <TextInput name="tools" defaultValue={values.tools} />
        </Field>
        <Field label="Human check" hint="Who approves what, until it earns autonomy.">
          <TextInput name="human_check" defaultValue={values.human_check} />
        </Field>
      </div>
      <Field label="Next step">
        <TextInput name="next_step" defaultValue={values.next_step} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Testing starts">
          <TextInput name="start_date" type="date" defaultValue={values.start_date} />
        </Field>
        <Field label="Decision due">
          <TextInput name="decision_date" type="date" defaultValue={values.decision_date} />
        </Field>
      </div>
      <div>
        <button type="submit" className={primaryButton}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

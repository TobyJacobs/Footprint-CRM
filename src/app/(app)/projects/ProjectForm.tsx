import { Field, Select, TextArea, TextInput, primaryButton } from "@/components/ui";
import { projectGroups, projectStatuses } from "@/lib/projects/options";
import CustomerSearchField from "./CustomerSearchField";

export type ProjectValues = {
  name?: string;
  customer?: { id: string; name: string } | null;
  owner_id?: string | null;
  status?: string;
  project_group?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  overview?: string | null;
  sales_order?: string | null;
};

export default function ProjectForm({
  action,
  people,
  templates,
  values = {},
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  people: { id: string; name: string }[];
  templates?: { id: string; name: string }[];
  values?: ProjectValues;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid max-w-3xl gap-4 rounded-lg border border-fp-border bg-white p-6">
      <Field label="Project name">
        <TextInput name="name" required defaultValue={values.name} />
      </Field>
      <Field label="Customer">
        <CustomerSearchField initial={values.customer ?? null} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sales order (optional)" hint="Most projects are created automatically from a sales order. Only needed for one made by hand.">
          <TextInput name="sales_order" defaultValue={values.sales_order} placeholder="e.g. SO-010913" />
        </Field>
        <Field label="Owner" hint="Only staff who have signed in to FootprintOS are listed.">
          <Select name="owner_id" options={people.map((p) => ({ value: p.id, label: p.name }))} defaultValue={values.owner_id} blank="Me" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Status">
          <Select name="status" options={projectStatuses} defaultValue={values.status ?? "active"} blank={false} />
        </Field>
        <Field label="Group">
          <Select name="project_group" options={projectGroups} defaultValue={values.project_group} />
        </Field>
        <Field label="Start date">
          <TextInput name="start_date" type="date" defaultValue={values.start_date} />
        </Field>
        <Field label="Due date">
          <TextInput name="due_date" type="date" defaultValue={values.due_date} />
        </Field>
      </div>
      {templates && (
        <Field label="Start from a template" hint="Adds the template's stages and steps as tasks.">
          <Select name="template_id" options={templates.map((t) => ({ value: t.id, label: t.name }))} blank="No template" />
        </Field>
      )}
      <Field label="Overview">
        <TextArea name="overview" rows={4} defaultValue={values.overview} />
      </Field>
      <div>
        <button type="submit" className={primaryButton}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

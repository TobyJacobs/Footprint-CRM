import { Field, Select, TextArea, TextInput, primaryButton } from "@/components/ui";
import { projectStatuses } from "@/lib/projects/options";
import CustomerSearchField from "./CustomerSearchField";

export type ProjectValues = {
  name?: string;
  customer?: { id: string; name: string } | null;
  owner_id?: string | null;
  status?: string;
  start_date?: string | null;
  due_date?: string | null;
  budget_hours?: number | null;
  description?: string | null;
  sales_order?: string | null;
};

export default function ProjectForm({
  action,
  people,
  values = {},
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  people: { id: string; name: string }[];
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
        <Field label="Sales order (optional)">
          <TextInput name="sales_order" defaultValue={values.sales_order} placeholder="e.g. SO-010913" />
        </Field>
        <Field label="Owner">
          <Select name="owner_id" options={people.map((p) => ({ value: p.id, label: p.name }))} defaultValue={values.owner_id} blank="Me" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Status">
          <Select name="status" options={projectStatuses} defaultValue={values.status ?? "active"} blank={false} />
        </Field>
        <Field label="Start date">
          <TextInput name="start_date" type="date" defaultValue={values.start_date} />
        </Field>
        <Field label="Due date">
          <TextInput name="due_date" type="date" defaultValue={values.due_date} />
        </Field>
        <Field label="Budget (hours)">
          <TextInput name="budget_hours" type="number" step="0.5" defaultValue={values.budget_hours === null || values.budget_hours === undefined ? "" : String(values.budget_hours)} />
        </Field>
      </div>
      <Field label="Description">
        <TextArea name="description" rows={4} defaultValue={values.description} />
      </Field>
      <div>
        <button type="submit" className={primaryButton}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

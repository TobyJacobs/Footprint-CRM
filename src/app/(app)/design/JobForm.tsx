import { Checkbox, Field, Select, TextArea, TextInput, primaryButton } from "@/components/ui";
import { designStages } from "@/lib/design/options";
import CustomerSearchField from "../projects/CustomerSearchField";

export type JobValues = {
  title?: string;
  brief?: string | null;
  customer?: { id: string; name: string } | null;
  sales_order_id?: string | null;
  project_id?: string | null;
  designer_id?: string | null;
  due_date?: string | null;
  high_priority?: boolean;
  stage?: string;
};

export default function JobForm({
  action,
  people,
  values = {},
  back,
  canSetStage,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  people: { id: string; name: string }[];
  values?: JobValues;
  back?: string;
  canSetStage: boolean;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4">
      {back && <input type="hidden" name="back" value={back} />}
      {values.sales_order_id && <input type="hidden" name="sales_order_id" value={values.sales_order_id} />}
      {values.project_id && <input type="hidden" name="project_id" value={values.project_id} />}
      <Field label="Title" hint="e.g. “Van livery for Smith & Sons” or “Forget Me Not advert, half page”">
        <TextInput name="title" required defaultValue={values.title} />
      </Field>
      <Field label="Customer" hint="Leave empty for Footprint's own work.">
        <CustomerSearchField initial={values.customer ?? null} />
      </Field>
      <Field label="Brief" hint="What's needed: sizes, wording, colours, deadlines, anything the designer should know.">
        <TextArea name="brief" rows={5} defaultValue={values.brief} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Designer" hint="Only staff who have signed in are listed.">
          <Select name="designer_id" options={people.map((p) => ({ value: p.id, label: p.name }))} defaultValue={values.designer_id} blank="Not assigned yet" />
        </Field>
        <Field label="Due date">
          <TextInput name="due_date" type="date" defaultValue={values.due_date} />
        </Field>
        {canSetStage ? (
          <Field label="Stage">
            <Select name="stage" options={designStages} defaultValue={values.stage ?? "todo"} blank={false} />
          </Field>
        ) : (
          <input type="hidden" name="stage" value={values.stage ?? "todo"} />
        )}
      </div>
      <Checkbox name="high_priority" label="High priority" defaultChecked={values.high_priority} />
      <div>
        <button type="submit" className={primaryButton}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

import { Field, Select, TextArea, TextInput, primaryButton } from "@/components/ui";
import { contentChannels, contentStatuses } from "@/lib/marketing/options";
import CustomerSearchField from "../../projects/CustomerSearchField";

export type ContentValues = {
  title?: string;
  customer?: { id: string; name: string } | null;
  channel?: string | null;
  status?: string;
  publish_date?: string | null;
  assignee_id?: string | null;
  link?: string | null;
  notes?: string | null;
};

export default function ContentForm({
  action,
  people,
  values = {},
  back,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  people: { id: string; name: string }[];
  values?: ContentValues;
  back: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid max-w-3xl gap-4 rounded-lg border border-fp-border bg-white p-6">
      <input type="hidden" name="back" value={back} />
      <Field label="Title" hint="e.g. “Spring offer carousel” or “Blog: 5 signage mistakes”">
        <TextInput name="title" required defaultValue={values.title} />
      </Field>
      <Field label="Client" hint="Leave empty for Footprint's own marketing.">
        <CustomerSearchField initial={values.customer ?? null} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Channel">
          <Select name="channel" options={contentChannels} defaultValue={values.channel} blank="Choose…" />
        </Field>
        <Field label="Status">
          <Select name="status" options={contentStatuses} defaultValue={values.status ?? "idea"} blank={false} />
        </Field>
        <Field label="Publish date">
          <TextInput name="publish_date" type="date" defaultValue={values.publish_date} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Who's doing it">
          <Select name="assignee_id" options={people.map((p) => ({ value: p.id, label: p.name }))} defaultValue={values.assignee_id} blank="Nobody yet" />
        </Field>
        <Field label="Link" hint="The draft, design file or live post.">
          <TextInput name="link" defaultValue={values.link} placeholder="https://" />
        </Field>
      </div>
      <Field label="Notes" hint="Copy ideas, hashtags, client feedback.">
        <TextArea name="notes" rows={4} defaultValue={values.notes} />
      </Field>
      <div>
        <button type="submit" className={primaryButton}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

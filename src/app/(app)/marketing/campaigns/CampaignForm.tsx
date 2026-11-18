import { Field, Select, TextArea, TextInput, primaryButton } from "@/components/ui";
import { adPlatforms, campaignStatuses } from "@/lib/marketing/options";
import CustomerSearchField from "../../projects/CustomerSearchField";

export type CampaignValues = {
  name?: string;
  customer?: { id: string; name: string } | null;
  platform?: string | null;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
  spend?: number | null;
  leads?: number | null;
  results?: string | null;
  owner_id?: string | null;
  notes?: string | null;
};

export default function CampaignForm({
  action,
  people,
  values = {},
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  people: { id: string; name: string }[];
  values?: CampaignValues;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid max-w-3xl gap-4 rounded-lg border border-fp-border bg-white p-6">
      <Field label="Campaign name" hint="e.g. “Spring sale – lead forms”">
        <TextInput name="name" required defaultValue={values.name} />
      </Field>
      <Field label="Client">
        <CustomerSearchField initial={values.customer ?? null} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Platform">
          <Select name="platform" options={adPlatforms} defaultValue={values.platform} blank="Choose…" />
        </Field>
        <Field label="Status">
          <Select name="status" options={campaignStatuses} defaultValue={values.status ?? "planned"} blank={false} />
        </Field>
        <Field label="Start date">
          <TextInput name="start_date" type="date" defaultValue={values.start_date} />
        </Field>
        <Field label="End date">
          <TextInput name="end_date" type="date" defaultValue={values.end_date} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Budget (£)" hint="Total ad spend agreed.">
          <TextInput name="budget" type="number" step="0.01" defaultValue={values.budget} />
        </Field>
        <Field label="Spent so far (£)">
          <TextInput name="spend" type="number" step="0.01" defaultValue={values.spend ?? 0} />
        </Field>
        <Field label="Leads">
          <TextInput name="leads" type="number" step="1" defaultValue={values.leads} />
        </Field>
        <Field label="Owner" hint="Only staff who have signed in to FootprintOS are listed.">
          <Select name="owner_id" options={people.map((p) => ({ value: p.id, label: p.name }))} defaultValue={values.owner_id} blank="Me" />
        </Field>
      </div>
      <Field label="Key results" hint="e.g. “2.1% CTR, £4.20 cost per lead, 18 calls”">
        <TextArea name="results" rows={2} defaultValue={values.results} />
      </Field>
      <Field label="Notes">
        <TextArea name="notes" rows={3} defaultValue={values.notes} />
      </Field>
      <div>
        <button type="submit" className={primaryButton}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

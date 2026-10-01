import Link from "next/link";
import { Card, Checkbox, CheckboxGroup, Field, Select, TextArea, TextInput, primaryButton, secondaryButton } from "@/components/ui";
import { contactFinancialStatuses, leadSources, marketingLists, salutations } from "@/lib/customers/options";

type Contact = Record<string, unknown>;

export default function ContactForm({
  contact,
  action,
  cancelHref,
}: {
  contact?: Contact;
  action: (fd: FormData) => Promise<void>;
  cancelHref: string;
}) {
  const v = (k: string) => (contact?.[k] as string | null | undefined) ?? null;

  return (
    <form action={action} className="grid max-w-3xl gap-6">
      <Card title="Person">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <Select name="salutation" options={salutations} defaultValue={v("salutation")} />
          </Field>
          <div />
          <Field label="First name">
            <TextInput name="first_name" defaultValue={v("first_name")} />
          </Field>
          <Field label="Last name">
            <TextInput name="last_name" defaultValue={v("last_name")} required />
          </Field>
          <Field label="Job title">
            <TextInput name="job_title" defaultValue={v("job_title")} />
          </Field>
          <Field label="Department">
            <TextInput name="department" defaultValue={v("department")} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox name="is_primary" label="Primary contact for this customer" defaultChecked={contact?.is_primary as boolean} />
          </div>
        </div>
      </Card>

      <Card title="Contact details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <TextInput name="email" type="email" defaultValue={v("email")} />
          </Field>
          <Field label="Second email">
            <TextInput name="secondary_email" type="email" defaultValue={v("secondary_email")} />
          </Field>
          <Field label="Phone">
            <TextInput name="phone" type="tel" defaultValue={v("phone")} />
          </Field>
          <Field label="Mobile">
            <TextInput name="mobile" type="tel" defaultValue={v("mobile")} />
          </Field>
          <Field label="Home phone">
            <TextInput name="home_phone" type="tel" defaultValue={v("home_phone")} />
          </Field>
          <div />
          <Field label="Street" wide>
            <TextArea name="street" rows={2} defaultValue={v("street")} />
          </Field>
          <Field label="Town / city">
            <TextInput name="city" defaultValue={v("city")} />
          </Field>
          <Field label="County">
            <TextInput name="county" defaultValue={v("county")} />
          </Field>
          <Field label="Postcode">
            <TextInput name="postcode" defaultValue={v("postcode")} />
          </Field>
          <Field label="Country">
            <TextInput name="country" defaultValue={v("country")} />
          </Field>
        </div>
      </Card>

      <Card title="Status & marketing">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Financial status">
            <Select name="financial_status" options={contactFinancialStatuses} defaultValue={v("financial_status")} />
          </Field>
          <Field label="Lead source">
            <Select name="lead_source" options={leadSources} defaultValue={v("lead_source")} />
          </Field>
          <div className="grid gap-2 sm:col-span-2">
            <Checkbox name="email_opt_out" label="Opted out of marketing emails" defaultChecked={contact?.email_opt_out as boolean} />
            <Checkbox name="include_in_emails" label="Include in marketing emails" defaultChecked={contact?.include_in_emails as boolean} />
            <p className="text-xs text-fp-mid">
              UK GDPR: only include people who have agreed to marketing. An opt-out always overrides this.
            </p>
          </div>
          <Field label="Marketing lists" wide>
            <CheckboxGroup name="marketing_lists" options={marketingLists} selected={contact?.marketing_lists as string[]} />
          </Field>
          <Field label="Notes" wide>
            <TextArea name="notes" defaultValue={v("notes")} />
          </Field>
        </div>
      </Card>

      <div className="flex gap-3">
        <button type="submit" className={primaryButton}>
          {contact ? "Save changes" : "Add contact"}
        </button>
        <Link href={cancelHref} className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

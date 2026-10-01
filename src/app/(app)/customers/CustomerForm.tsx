import Link from "next/link";
import {
  Card, CheckboxGroup, Field, Select, TextArea, TextInput, primaryButton, secondaryButton,
} from "@/components/ui";
import { toLocalInput } from "@/lib/customers/display";
import {
  accountTypes, brochures, creditStatuses, customerStatuses, directDebitStatuses,
  directDebitStatusesFmn, heardAboutUs, invoiceDueTerms, ownershipTypes, services,
} from "@/lib/customers/options";

export type CustomerRecord = Record<string, unknown> & { id?: string };

// One form for adding and editing a customer.
export default function CustomerForm({
  customer,
  staff,
  action,
  cancelHref,
}: {
  customer?: CustomerRecord;
  staff: { id: string; name: string }[];
  action: (fd: FormData) => Promise<void>;
  cancelHref: string;
}) {
  const v = (k: string) => (customer?.[k] as string | number | null | undefined) ?? null;
  const arr = (k: string) => (customer?.[k] as string[] | undefined) ?? [];

  return (
    <form action={action} className="grid max-w-4xl gap-6">
      <input type="hidden" name="parent_id" defaultValue={(v("parent_id") as string) ?? ""} />

      <Card title="Customer">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" wide>
            <TextInput name="name" defaultValue={v("name")} required />
          </Field>
          <Field label="Status">
            <Select name="status" options={customerStatuses} defaultValue={v("status") as string} />
          </Field>
          <Field label="Type">
            <Select name="account_type" options={accountTypes} defaultValue={v("account_type") as string} />
          </Field>
          <Field label="Phone">
            <TextInput name="phone" type="tel" defaultValue={v("phone")} />
          </Field>
          <Field label="Company email">
            <TextInput name="email" type="email" defaultValue={v("email")} />
          </Field>
          <Field label="Website">
            <TextInput name="website" defaultValue={v("website")} placeholder="www.example.co.uk" />
          </Field>
          <Field label="Account owner">
            <Select
              name="owner_id"
              options={staff.map((s) => ({ value: s.id, label: s.name }))}
              defaultValue={v("owner_id") as string}
            />
          </Field>
          <Field label="Industry">
            <TextInput name="industry" defaultValue={v("industry")} />
          </Field>
          <Field label="Ownership">
            <Select name="ownership" options={ownershipTypes} defaultValue={v("ownership") as string} />
          </Field>
          <Field label="Services they use" wide>
            <CheckboxGroup name="services" options={services} selected={arr("services")} />
          </Field>
          <Field label="Description" wide>
            <TextArea name="description" defaultValue={v("description") as string} />
          </Field>
        </div>
      </Card>

      <Card title="Addresses">
        <div className="grid gap-6 sm:grid-cols-2">
          {(["billing", "shipping"] as const).map((kind) => (
            <div key={kind} className="grid gap-3">
              <p className="text-sm font-bold capitalize">{kind} address</p>
              <Field label="Street">
                <TextArea name={`${kind}_street`} rows={2} defaultValue={v(`${kind}_street`) as string} />
              </Field>
              <Field label="Town / city">
                <TextInput name={`${kind}_city`} defaultValue={v(`${kind}_city`)} />
              </Field>
              <Field label="County">
                <TextInput name={`${kind}_county`} defaultValue={v(`${kind}_county`)} />
              </Field>
              <Field label="Postcode">
                <TextInput name={`${kind}_postcode`} defaultValue={v(`${kind}_postcode`)} />
              </Field>
              <Field label="Country">
                <TextInput name={`${kind}_country`} defaultValue={v(`${kind}_country`) ?? (customer ? null : "United Kingdom")} />
              </Field>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Accounts & credit">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Credit status" wide>
            <Select name="credit_status" options={creditStatuses} defaultValue={v("credit_status") as string} />
          </Field>
          <Field label="Direct Debit – Print & Digital">
            <Select name="direct_debit_status" options={directDebitStatuses} defaultValue={v("direct_debit_status") as string} />
          </Field>
          <Field label="Direct Debit – Forget Me Not">
            <Select name="direct_debit_status_fmn" options={directDebitStatusesFmn} defaultValue={v("direct_debit_status_fmn") as string} />
          </Field>
          <Field label="Invoices due (days)">
            <TextInput name="invoice_due_days" type="number" defaultValue={v("invoice_due_days")} />
          </Field>
          <Field label="Invoices due (when)">
            <Select name="invoice_due_terms" options={invoiceDueTerms} defaultValue={v("invoice_due_terms") as string} />
          </Field>
          <Field label="Sales discount %">
            <TextInput name="sales_discount_percent" type="number" step="0.01" defaultValue={v("sales_discount_percent")} />
          </Field>
          <Field label="Default sales account">
            <TextInput name="default_sales_account" defaultValue={v("default_sales_account")} />
          </Field>
          <Field label="Xero contact ID" hint="Links this customer to Xero.">
            <TextInput name="xero_contact_id" defaultValue={v("xero_contact_id")} />
          </Field>
        </div>
      </Card>

      <Card title="Sales & marketing">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How did they hear about us?" wide>
            <CheckboxGroup name="heard_about_us" options={heardAboutUs} selected={arr("heard_about_us")} />
          </Field>
          <Field label="Brochures sent" wide>
            <CheckboxGroup name="brochures_sent" options={brochures} selected={arr("brochures_sent")} />
          </Field>
          <Field label="Last contacted">
            <TextInput name="last_contacted_on" type="date" defaultValue={v("last_contacted_on")} />
          </Field>
          <Field label="Follow up">
            <TextInput name="follow_up_at" type="datetime-local" defaultValue={toLocalInput(v("follow_up_at") as string)} />
          </Field>
          <Field label="Date last ordered">
            <TextInput name="date_last_ordered" type="date" defaultValue={v("date_last_ordered")} />
          </Field>
        </div>
      </Card>

      <div className="flex gap-3">
        <button type="submit" className={primaryButton}>
          {customer ? "Save changes" : "Add customer"}
        </button>
        <Link href={cancelHref} className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

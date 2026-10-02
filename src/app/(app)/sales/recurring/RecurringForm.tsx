import Link from "next/link";
import { Card, Checkbox, Field, Select, TextArea, TextInput, primaryButton, secondaryButton } from "@/components/ui";
import { businessUnits, frequencies, recurringStatuses } from "@/lib/sales/options";
import DocumentEditor, { type EditorLine } from "../DocumentEditor";

export default function RecurringForm({
  recurring,
  lines,
  customer,
  contacts,
  taxRates,
  staff,
  defaults,
  action,
  cancelHref,
}: {
  recurring?: Record<string, unknown>;
  lines: EditorLine[];
  customer: { id: string; name: string; credit_status: string | null } | null;
  contacts: { id: string; first_name: string | null; last_name: string; email: string | null; is_primary: boolean }[];
  taxRates: { id: string; name: string; rate: number }[];
  staff: { id: string; name: string }[];
  defaults: {
    name?: string | null;
    frequency?: string;
    next_date: string;
    owner_id?: string;
    hosting_plan_id?: string | null;
    retainer_id?: string | null;
    business_unit?: string | null;
  };
  action: (fd: FormData) => Promise<void>;
  cancelHref: string;
}) {
  const v = (k: string) => (recurring?.[k] as string | null | undefined) ?? null;
  return (
    <form action={action} className="grid max-w-6xl gap-6">
      <input type="hidden" name="hosting_plan_id" defaultValue={v("hosting_plan_id") ?? defaults.hosting_plan_id ?? ""} />
      <input type="hidden" name="retainer_id" defaultValue={v("retainer_id") ?? defaults.retainer_id ?? ""} />

      <Card title="Schedule">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" hint="Appears on each invoice, e.g. “Website hosting — October 2026”." wide>
            <TextInput name="name" defaultValue={v("name") ?? defaults.name ?? null} required />
          </Field>
          <Field label="How often">
            <Select name="frequency" options={frequencies} defaultValue={v("frequency") ?? defaults.frequency ?? "monthly"} blank={false} />
          </Field>
          <Field label="Status">
            <Select name="status" options={recurringStatuses} defaultValue={v("status") ?? "active"} blank={false} />
          </Field>
          <Field label="Next invoice date">
            <TextInput name="next_date" type="date" defaultValue={v("next_date") ?? defaults.next_date} required />
          </Field>
          <Field label="Stop after (optional)">
            <TextInput name="end_date" type="date" defaultValue={v("end_date")} />
          </Field>
          <Field label="Account owner">
            <Select
              name="owner_id"
              options={staff.map((s) => ({ value: s.id, label: s.name }))}
              defaultValue={v("owner_id") ?? defaults.owner_id ?? null}
            />
          </Field>
          <Field label="Business unit">
            <Select name="business_unit" options={businessUnits} defaultValue={v("business_unit") ?? defaults.business_unit ?? null} />
          </Field>
          <Field label="Customer's reference / PO">
            <TextInput name="customer_reference" defaultValue={v("customer_reference")} />
          </Field>
          <div className="flex items-end pb-2 sm:col-span-2 lg:col-span-3">
            <Checkbox
              name="auto_issue"
              label="Issue invoices automatically (otherwise they're created as drafts for someone to check)"
              defaultChecked={recurring?.auto_issue as boolean}
            />
          </div>
        </div>
      </Card>

      <Card title="What to bill each time">
        <DocumentEditor
          initialCustomer={customer ? { id: customer.id, name: customer.name } : null}
          initialContacts={contacts}
          initialContactId={v("contact_id") ?? contacts.find((p) => p.is_primary)?.id ?? null}
          initialLines={lines}
          taxRates={taxRates}
          creditWarning={customer?.credit_status && /ON STOP|Up Front|before we order/i.test(customer.credit_status) ? customer.credit_status : null}
        />
      </Card>

      <Card title="Notes">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Notes on each invoice" hint="Leave blank to use the standard invoice notes.">
            <TextArea name="notes" rows={3} defaultValue={v("notes")} />
          </Field>
          <Field label="Internal notes">
            <TextArea name="internal_notes" rows={3} defaultValue={v("internal_notes")} />
          </Field>
        </div>
      </Card>

      <div className="flex gap-3">
        <button type="submit" className={primaryButton}>
          {recurring ? "Save changes" : "Create recurring invoice"}
        </button>
        <Link href={cancelHref} className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

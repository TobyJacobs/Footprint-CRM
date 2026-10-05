import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Card, Checkbox, Field, Select, TextArea, TextInput, primaryButton, secondaryButton } from "@/components/ui";
import {
  businessUnits, creditReasons, deliveryTypes, docTypes, expectedDates, lossReasons, probabilities, productionSteps,
  type DocType,
} from "@/lib/sales/options";
import DocumentEditor, { type EditorLine } from "./DocumentEditor";

type Doc = Record<string, unknown>;

export default async function DocumentForm({
  docType,
  doc,
  lines,
  customer,
  contacts,
  taxRates,
  staff,
  defaults,
  action,
  cancelHref,
}: {
  docType: DocType;
  doc?: Doc;
  lines: EditorLine[];
  customer: { id: string; name: string; credit_status: string | null } | null;
  contacts: { id: string; first_name: string | null; last_name: string; email: string | null; is_primary: boolean }[];
  taxRates: { id: string; name: string; rate: number }[];
  staff: { id: string; name: string }[];
  defaults: { issue_date: string; valid_until?: string; due_date?: string; terms?: string | null; notes?: string | null; owner_id?: string };
  action: (fd: FormData) => Promise<void>;
  cancelHref: string;
}) {
  const v = (k: string) => (doc?.[k] as string | number | null | undefined) ?? null;
  const label = docTypes[docType].label;
  const creditWarning =
    customer?.credit_status && /ON STOP|Up Front|before we order/i.test(customer.credit_status) ? customer.credit_status : null;

  return (
    <form action={action} className="grid max-w-6xl gap-6">
      <Card title={label}>
        <DocumentEditor
          initialCustomer={customer ? { id: customer.id, name: customer.name } : null}
          initialContacts={contacts}
          initialContactId={(v("contact_id") as string) ?? contacts.find((p) => p.is_primary)?.id ?? null}
          initialLines={lines}
          taxRates={taxRates}
          canAddCustomer={(await getCurrentUser()).can("customers", "edit")}
          creditWarning={creditWarning}
        />
      </Card>

      <Card title="Details">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Title" wide>
            <TextInput name="title" defaultValue={v("title")} placeholder="e.g. Spring leaflets & window vinyls" />
          </Field>
          <Field label="Customer's reference / PO">
            <TextInput name="customer_reference" defaultValue={v("customer_reference")} />
          </Field>
          <Field label="Salesperson">
            <Select
              name="owner_id"
              options={staff.map((s) => ({ value: s.id, label: s.name }))}
              defaultValue={(v("owner_id") as string) ?? defaults.owner_id ?? null}
            />
          </Field>
          <Field label="Date">
            <TextInput name="issue_date" type="date" defaultValue={v("issue_date") ?? defaults.issue_date} required />
          </Field>
          {docType === "quote" && (
            <Field label="Valid until">
              <TextInput name="valid_until" type="date" defaultValue={v("valid_until") ?? defaults.valid_until ?? null} />
            </Field>
          )}
          {docType === "invoice" && (
            <Field label="Due date">
              <TextInput name="due_date" type="date" defaultValue={v("due_date") ?? defaults.due_date ?? null} />
            </Field>
          )}
          {docType === "sales_order" && (
            <Field label="Deadline">
              <TextInput name="deadline_date" type="date" defaultValue={v("deadline_date")} />
            </Field>
          )}
          <Field label="Business unit">
            <Select name="business_unit" options={businessUnits} defaultValue={v("business_unit") as string} />
          </Field>
          {docType === "quote" && (
            <>
              <Field label="Probability">
                <Select name="probability" options={probabilities} defaultValue={v("probability") as string} />
              </Field>
              <Field label="Expected order">
                <Select name="expected_date" options={expectedDates} defaultValue={v("expected_date") as string} />
              </Field>
              <Field label="Reason for loss">
                <Select name="reason_for_loss" options={lossReasons} defaultValue={v("reason_for_loss") as string} />
              </Field>
            </>
          )}
          {docType === "sales_order" && (
            <>
              <Field label="Production step">
                <Select name="production_step" options={productionSteps} defaultValue={(v("production_step") as string) ?? "New Sales Order"} />
              </Field>
              <Field label="Expected invoice">
                <Select name="expected_date" options={expectedDates} defaultValue={v("expected_date") as string} />
              </Field>
            </>
          )}
          {(docType === "quote" || docType === "sales_order") && (
            <Field label="Delivery">
              <Select name="delivery_type" options={deliveryTypes} defaultValue={v("delivery_type") as string} />
            </Field>
          )}
          {docType === "credit_note" ? (
            <Field label="Reason for credit">
              <Select name="credit_reason" options={creditReasons} defaultValue={v("credit_reason") as string} />
            </Field>
          ) : (
            <Field label="Labour cost (£)">
              <TextInput name="labour_cost" type="number" step="0.01" defaultValue={v("labour_cost")} />
            </Field>
          )}
          {docType === "sales_order" && (
            <div className="grid gap-2 sm:col-span-2 lg:col-span-4">
              <Checkbox name="copy_shop_job" label="Copy shop job" defaultChecked={doc?.copy_shop_job as boolean} />
              <Checkbox name="consumer_copy_shop" label="Consumer copy shop job" defaultChecked={doc?.consumer_copy_shop as boolean} />
              <Field label="Time spent on copy shop job (minutes)">
                <TextInput name="copy_shop_minutes" type="number" defaultValue={v("copy_shop_minutes")} />
              </Field>
            </div>
          )}
          {docType === "invoice" && (
            <div className="sm:col-span-2">
              <Checkbox name="collected" label="Collected" defaultChecked={doc?.collected as boolean} />
            </div>
          )}
        </div>
      </Card>

      <Card title="Notes">
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Notes for the customer">
            <TextArea name="notes" rows={4} defaultValue={(v("notes") as string) ?? defaults.notes ?? null} />
          </Field>
          <Field label="Terms">
            <TextArea name="terms" rows={4} defaultValue={(v("terms") as string) ?? defaults.terms ?? null} />
          </Field>
          <Field label="Internal notes" hint="Never shown to the customer.">
            <TextArea name="internal_notes" rows={4} defaultValue={v("internal_notes") as string} />
          </Field>
        </div>
      </Card>

      <div className="flex gap-3">
        <button type="submit" className={primaryButton}>
          {doc ? "Save changes" : `Create ${label.toLowerCase()}`}
        </button>
        <Link href={cancelHref} className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Card, Checkbox, Field, Select, TextArea, TextInput, primaryButton, secondaryButton } from "@/components/ui";
import {
  businessUnits, quoteBusinessUnits, quoteKindLabel, creditReasons, deliveryTypes, docTypes, expectedDates, probabilities,
  type DocType,
} from "@/lib/sales/options";
import AddressFields from "./AddressFields";
import DocumentEditor, { type EditorLine } from "./DocumentEditor";

type Doc = Record<string, unknown>;

export default async function DocumentForm({
  docType,
  quoteKind,
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
  // For a new quote: standard, advertising or proposal (an existing one keeps its own).
  quoteKind?: string;
  doc?: Doc;
  lines: EditorLine[];
  customer: { id: string; name: string; credit_status: string | null } | null;
  contacts: { id: string; first_name: string | null; last_name: string; email: string | null; is_primary: boolean }[];
  taxRates: { id: string; name: string; rate: number }[];
  staff: { id: string; name: string }[];
  defaults: {
    issue_date: string;
    valid_until?: string;
    due_date?: string;
    terms?: string | null;
    notes?: string | null;
    owner_id?: string;
    title?: string | null;
    business_unit?: string | null;
    contact_id?: string | null;
  };
  action: (fd: FormData) => Promise<void>;
  cancelHref: string;
}) {
  const v = (k: string) => (doc?.[k] as string | number | null | undefined) ?? null;
  const kind = (v("quote_kind") as string | null) ?? quoteKind ?? "quote";
  const label = docType === "quote" && kind !== "quote" ? quoteKindLabel(kind) : docTypes[docType].label;
  const creditWarning =
    customer?.credit_status && /ON STOP|Up Front|before we order/i.test(customer.credit_status) ? customer.credit_status : null;

  return (
    <form id="document-form" action={action} className="grid max-w-6xl gap-6">
      {docType === "quote" && <input type="hidden" name="quote_kind" value={kind} />}
      <Card title={label}>
        <DocumentEditor
          initialCustomer={customer ? { id: customer.id, name: customer.name } : null}
          initialContacts={contacts}
          initialContactId={(v("contact_id") as string) ?? defaults.contact_id ?? contacts.find((p) => p.is_primary)?.id ?? null}
          initialLines={lines}
          kind={docType === "quote" ? kind : "quote"}
          // Labour is entered with the lines (not on credit notes).
          initialLabour={docType === "credit_note" ? undefined : ((v("labour_cost") as number | null) ?? null)}
          taxRates={taxRates}
          canAddCustomer={(await getCurrentUser()).can("customers", "edit")}
          creditWarning={creditWarning}
        />
      </Card>

      {docType === "sales_order" && (
        <Card title="Addresses & delivery">
          <AddressFields
            customerId={customer?.id ?? null}
            initial={{ billing: v("billing_address") as string | null, delivery: v("delivery_address") as string | null, notes: v("delivery_notes") as string | null, warehouse: v("warehouse") as string | null }}
          />
        </Card>
      )}

      <Card title="Details">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Title" wide>
            <TextInput name="title" defaultValue={v("title") ?? defaults.title ?? null} placeholder="e.g. Spring leaflets & window vinyls" />
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
            <Select name="business_unit" options={docType === "quote" ? quoteBusinessUnits : businessUnits} defaultValue={(v("business_unit") as string) ?? defaults.business_unit ?? null} />
          </Field>
          {docType === "quote" && (
            // Forecasting extras, out of the way unless wanted. The reason for
            // loss is asked when the quote is marked declined.
            <details className="sm:col-span-2 lg:col-span-4" open={!!(v("probability") || v("expected_date"))}>
              <summary className="cursor-pointer text-sm font-semibold text-fp-teal-deep">More details (probability, expected order)</summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Probability">
                  <Select name="probability" options={probabilities} defaultValue={v("probability") as string} />
                </Field>
                <Field label="Expected order">
                  <Select name="expected_date" options={expectedDates} defaultValue={v("expected_date") as string} />
                </Field>
              </div>
            </details>
          )}
          {docType === "sales_order" && (
            // The order's stage is shown by the stage bar (no production step to set).
            <Field label="Expected invoice">
              <Select name="expected_date" options={expectedDates} defaultValue={v("expected_date") as string} />
            </Field>
          )}
          {(docType === "quote" || docType === "sales_order") && (
            <Field label="Delivery">
              <Select name="delivery_type" options={deliveryTypes} defaultValue={v("delivery_type") as string} />
            </Field>
          )}
          {docType === "credit_note" && (
            <Field label="Reason for credit">
              <Select name="credit_reason" options={creditReasons} defaultValue={v("credit_reason") as string} />
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
          <Field
            label={kind === "proposal" ? "The proposal (the customer sees this)" : "Notes for the customer"}
            hint={kind === "proposal" ? "Fill in each section; the pricing comes from the lines above." : undefined}
            wide={kind === "proposal"}
          >
            <TextArea name="notes" rows={kind === "proposal" ? 14 : 4} defaultValue={(v("notes") as string) ?? defaults.notes ?? null} />
          </Field>
          <Field label="Terms">
            <TextArea name="terms" rows={4} defaultValue={(v("terms") as string) ?? defaults.terms ?? null} />
          </Field>
          <Field label="Internal notes" hint="Never shown to the customer.">
            <TextArea name="internal_notes" rows={4} defaultValue={v("internal_notes") as string} />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {!doc && docType === "quote" ? (
          <>
            {/* Send: saves and emails it (with its PDF) to the contact; with no
                contact email it's saved as a draft and the email box opens. */}
            <button type="submit" name="intent" value="send" className={primaryButton}>
              Send {label.toLowerCase()}
            </button>
            <button type="submit" name="intent" value="draft" className={secondaryButton}>
              Save as draft
            </button>
          </>
        ) : (
          <button type="submit" className={primaryButton}>
            {doc ? "Save changes" : `Create ${label.toLowerCase()}`}
          </button>
        )}
        <Link href={cancelHref} className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

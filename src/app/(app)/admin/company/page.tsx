import { Card, Field, Notice, TextArea, TextInput, primaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveCompanySettings } from "../actions";

const docLabels: Record<string, string> = {
  quote: "Quotes",
  sales_order: "Sales orders",
  invoice: "Invoices",
  purchase_order: "Purchase orders",
  credit_note: "Credit notes",
};

export default async function CompanyPage(props: PageProps<"/admin/company">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: s }, { data: seqs }] = await Promise.all([
    supabase.from("company_settings").select("*").single(),
    supabase.from("number_sequences").select("*").order("doc_type"),
  ]);
  const v = (k: string) => (s?.[k] as string | number | null | undefined) ?? null;

  return (
    <>
      <Notice searchParams={sp} />
      <form action={saveCompanySettings} className="grid max-w-4xl gap-6">
        <Card title="Company details (shown on quotes and invoices)">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trading name">
              <TextInput name="company_name" defaultValue={v("company_name")} required />
            </Field>
            <Field label="Legal name">
              <TextInput name="legal_name" defaultValue={v("legal_name")} placeholder="e.g. Footprint South Copy and Design Ltd" />
            </Field>
            <Field label="Address" wide>
              <TextArea name="address" defaultValue={v("address") as string} />
            </Field>
            <Field label="Phone">
              <TextInput name="phone" defaultValue={v("phone")} />
            </Field>
            <Field label="Email">
              <TextInput name="email" type="email" defaultValue={v("email")} />
            </Field>
            <Field label="Website">
              <TextInput name="website" defaultValue={v("website")} />
            </Field>
            <Field label="VAT number">
              <TextInput name="vat_number" defaultValue={v("vat_number")} />
            </Field>
            <Field label="Company number">
              <TextInput name="company_number" defaultValue={v("company_number")} />
            </Field>
            <Field label="Bank details (printed on invoices)" hint="Stored in the database, never in the code." wide>
              <TextArea name="bank_details" defaultValue={v("bank_details") as string} />
            </Field>
          </div>
        </Card>

        <Card title="Default wording">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quote terms">
              <TextArea name="quote_terms" rows={4} defaultValue={v("quote_terms") as string} />
            </Field>
            <Field label="Sales order terms">
              <TextArea name="order_terms" rows={4} defaultValue={v("order_terms") as string} />
            </Field>
            <Field label="Invoice notes">
              <TextArea name="invoice_notes" rows={4} defaultValue={v("invoice_notes") as string} />
            </Field>
            <Field label="Invoice terms">
              <TextArea name="invoice_terms" rows={4} defaultValue={v("invoice_terms") as string} />
            </Field>
            <Field label="Quotes valid for (days)">
              <TextInput name="quote_valid_days" type="number" defaultValue={v("quote_valid_days")} />
            </Field>
            <Field label="Invoices due after (days)">
              <TextInput name="invoice_due_days" type="number" defaultValue={v("invoice_due_days")} />
            </Field>
          </div>
        </Card>

        <Card title="Document numbering">
          <p className="mb-4 text-sm text-fp-dark/75">
            The next number each document will get. Numbers can only be moved forwards, so there are never duplicates.
            At go-live these are set to carry on from Zoho.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(seqs ?? []).map((q) => (
              <Field key={q.doc_type} label={`${docLabels[q.doc_type] ?? q.doc_type} (${q.prefix}…)`}>
                <TextInput name={`next_${q.doc_type}`} type="number" defaultValue={q.next_number} />
              </Field>
            ))}
          </div>
        </Card>

        <div>
          <button type="submit" className={primaryButton}>
            Save
          </button>
        </div>
      </form>
    </>
  );
}

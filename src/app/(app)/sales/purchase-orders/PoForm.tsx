import Link from "next/link";
import { Card, Field, Select, TextArea, TextInput, primaryButton, secondaryButton } from "@/components/ui";
import PoLinesEditor, { type PoEditorLine } from "./PoLinesEditor";

export default function PoForm({
  po,
  lines,
  suppliers,
  taxRates,
  staff,
  defaults,
  action,
  cancelHref,
}: {
  po?: Record<string, unknown>;
  lines: PoEditorLine[];
  suppliers: { id: string; name: string }[];
  taxRates: { id: string; name: string; rate: number }[];
  staff: { id: string; name: string }[];
  defaults: { issue_date: string; owner_id?: string; supplier_id?: string | null; sales_document_id?: string | null };
  action: (fd: FormData) => Promise<void>;
  cancelHref: string;
}) {
  const v = (k: string) => (po?.[k] as string | null | undefined) ?? null;
  return (
    <form action={action} className="grid max-w-6xl gap-6">
      <input type="hidden" name="sales_document_id" defaultValue={v("sales_document_id") ?? defaults.sales_document_id ?? ""} />
      <Card title="Purchase order">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Supplier">
            <Select
              name="supplier_id"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              defaultValue={v("supplier_id") ?? defaults.supplier_id ?? null}
              blank="Choose a supplier…"
            />
          </Field>
          <Field label="Date">
            <TextInput name="issue_date" type="date" defaultValue={v("issue_date") ?? defaults.issue_date} required />
          </Field>
          <Field label="Needed by">
            <TextInput name="expected_date" type="date" defaultValue={v("expected_date")} />
          </Field>
          <Field label="Raised by">
            <Select
              name="owner_id"
              options={staff.map((s) => ({ value: s.id, label: s.name }))}
              defaultValue={v("owner_id") ?? defaults.owner_id ?? null}
            />
          </Field>
          <Field label="Deliver to" wide>
            <TextInput name="deliver_to" defaultValue={v("deliver_to") ?? (po ? null : "Footprint Group")} />
          </Field>
          <Field label="Supplier's reference">
            <TextInput name="supplier_reference" defaultValue={v("supplier_reference")} />
          </Field>
        </div>
        <PoLinesEditor initialLines={lines} taxRates={taxRates} />
      </Card>
      <Card title="Notes">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Notes for the supplier">
            <TextArea name="notes" rows={4} defaultValue={v("notes")} />
          </Field>
          <Field label="Internal notes" hint="Never shown to the supplier.">
            <TextArea name="internal_notes" rows={4} defaultValue={v("internal_notes")} />
          </Field>
        </div>
      </Card>
      <div className="flex gap-3">
        <button type="submit" className={primaryButton}>
          {po ? "Save changes" : "Create purchase order"}
        </button>
        <Link href={cancelHref} className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

import Link from "next/link";
import { Card, Checkbox, Field, TextArea, TextInput, primaryButton, secondaryButton } from "@/components/ui";

export default function SupplierForm({ supplier, action }: { supplier?: Record<string, unknown>; action: (fd: FormData) => Promise<void> }) {
  const v = (k: string) => (supplier?.[k] as string | null | undefined) ?? null;
  return (
    <form action={action} className="grid max-w-3xl gap-6">
      <Card title="Supplier">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" wide>
            <TextInput name="name" defaultValue={v("name")} required />
          </Field>
          <Field label="Contact name">
            <TextInput name="contact_name" defaultValue={v("contact_name")} />
          </Field>
          <Field label="Our account number with them">
            <TextInput name="account_reference" defaultValue={v("account_reference")} />
          </Field>
          <Field label="Email (for sending purchase orders)">
            <TextInput name="email" type="email" defaultValue={v("email")} />
          </Field>
          <Field label="Phone">
            <TextInput name="phone" type="tel" defaultValue={v("phone")} />
          </Field>
          <Field label="Address" wide>
            <TextArea name="address" defaultValue={v("address")} />
          </Field>
          <Field label="Notes" wide>
            <TextArea name="notes" defaultValue={v("notes")} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox name="active" label="Active (can be chosen on products and purchase orders)" defaultChecked={supplier ? (supplier.active as boolean) : true} />
          </div>
        </div>
      </Card>
      <div className="flex gap-3">
        <button type="submit" className={primaryButton}>
          {supplier ? "Save changes" : "Add supplier"}
        </button>
        <Link href="/sales/suppliers" className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

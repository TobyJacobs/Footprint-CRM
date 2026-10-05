import Link from "next/link";
import { Card, Checkbox, Field, Select, TextArea, TextInput, primaryButton, secondaryButton } from "@/components/ui";
import { businessUnits, units } from "@/lib/sales/options";

export default function ProductForm({
  product,
  suppliers,
  taxRates,
  salesAccounts,
  action,
}: {
  product?: Record<string, unknown>;
  suppliers: { id: string; name: string }[];
  taxRates: { id: string; name: string; rate: number }[];
  salesAccounts: { code: string; name: string }[];
  action: (fd: FormData) => Promise<void>;
}) {
  const v = (k: string) => (product?.[k] as string | number | null | undefined) ?? null;
  return (
    <form action={action} className="grid max-w-3xl gap-6">
      <Card title="Product">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" wide>
            <TextInput name="name" defaultValue={v("name")} required />
          </Field>
          <Field label="Description" hint="Copied onto quote lines." wide>
            <TextArea name="description" defaultValue={v("description") as string} />
          </Field>
          <Field label="Selling price (£, excl. VAT)">
            <TextInput name="sale_price" type="number" step="0.01" defaultValue={v("sale_price") ?? 0} required />
          </Field>
          <Field label="Cost to us (£)">
            <TextInput name="cost_price" type="number" step="0.01" defaultValue={v("cost_price")} />
          </Field>
          <Field label="VAT">
            <Select
              name="tax_rate_id"
              options={taxRates.map((r) => ({ value: r.id, label: r.name }))}
              defaultValue={(v("tax_rate_id") as string) ?? taxRates[0]?.id ?? null}
              blank={false}
            />
          </Field>
          <Field label="Unit">
            <Select name="unit" options={units} defaultValue={v("unit") as string} />
          </Field>
          <Field label="Supplier">
            <Select name="supplier_id" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} defaultValue={v("supplier_id") as string} />
          </Field>
          <Field label="Business unit">
            <Select name="business_unit" options={businessUnits} defaultValue={v("business_unit") as string} />
          </Field>
          <Field label="Product number" hint="From Zoho. Goes on quote lines and to Xero.">
            <TextInput name="sku" defaultValue={v("sku")} />
          </Field>
          <Field label="Sales account" hint="The income account Xero posts this product's sales to.">
            <Select
              name="sales_account_code"
              options={salesAccounts.map((a) => ({ value: a.code, label: `${a.code} – ${a.name}` }))}
              defaultValue={v("sales_account_code") as string}
            />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox name="active" label="Available to sell" defaultChecked={product ? (product.active as boolean) : true} />
          </div>
        </div>
      </Card>
      <div className="flex gap-3">
        <button type="submit" className={primaryButton}>
          {product ? "Save changes" : "Add product"}
        </button>
        <Link href="/sales/products" className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

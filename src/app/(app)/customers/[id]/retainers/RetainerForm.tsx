import Link from "next/link";
import { Card, Field, Select, TextArea, TextInput, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { retainerServices, retainerStatuses } from "@/lib/customers/options";

type Service = {
  service: string;
  qty_per_month: number | null;
  platforms: string | null;
  ad_spend: number | null;
  notes: string | null;
};
type Retainer = Record<string, unknown> & { retainer_services?: Service[] };

export default function RetainerForm({
  retainer,
  staff,
  action,
  cancelHref,
}: {
  retainer?: Retainer;
  staff: { id: string; name: string }[];
  action: (fd: FormData) => Promise<void>;
  cancelHref: string;
}) {
  const v = (k: string) => (retainer?.[k] as string | number | null | undefined) ?? null;
  const staffOptions = staff.map((s) => ({ value: s.id, label: s.name }));
  const services = [...(retainer?.retainer_services ?? []), ...Array.from({ length: 3 }, () => null)];

  return (
    <form action={action} className="grid max-w-4xl gap-6">
      <Card title="Retainer">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" wide>
            <TextInput name="name" defaultValue={v("name")} required placeholder="e.g. Social & Google Ads retainer" />
          </Field>
          <Field label="Status">
            <Select name="status" options={retainerStatuses} defaultValue={(v("status") as string) ?? (retainer ? null : "Live")} />
          </Field>
          <Field label="Monthly fee (£)">
            <TextInput name="monthly_fee" type="number" step="0.01" defaultValue={v("monthly_fee")} />
          </Field>
          <Field label="Budget hours">
            <TextInput name="budget_hours" type="number" defaultValue={v("budget_hours")} />
          </Field>
          <Field label="Subscription number">
            <TextInput name="subscription_number" defaultValue={v("subscription_number")} />
          </Field>
          <Field label="Digital account manager">
            <Select name="digital_am_id" options={staffOptions} defaultValue={v("digital_am_id") as string} />
          </Field>
          <Field label="Sales account manager">
            <Select name="sales_am_id" options={staffOptions} defaultValue={v("sales_am_id") as string} />
          </Field>
        </div>
      </Card>

      <Card title="Monthly services">
        <div className="grid gap-3">
          {services.map((s, n) => (
            <div key={n} className="grid gap-2 rounded-md border border-fp-border p-3 sm:grid-cols-[1.3fr_0.6fr_1fr_0.7fr] sm:items-end">
              <Field label="Service">
                <Select name={`svc_${n}_service`} options={retainerServices} defaultValue={s?.service} />
              </Field>
              <Field label="Qty / month">
                <input name={`svc_${n}_qty`} type="number" defaultValue={s?.qty_per_month ?? ""} className={inputClass} />
              </Field>
              <Field label="Platforms">
                <input name={`svc_${n}_platforms`} defaultValue={s?.platforms ?? ""} className={inputClass} />
              </Field>
              <Field label="Ad spend (£)">
                <input name={`svc_${n}_spend`} type="number" step="0.01" defaultValue={s?.ad_spend ?? ""} className={inputClass} />
              </Field>
              <div className="sm:col-span-4">
                <input name={`svc_${n}_notes`} defaultValue={s?.notes ?? ""} placeholder="Notes" className={inputClass} />
              </div>
            </div>
          ))}
          <p className="text-xs text-fp-mid">Leave the service empty to remove a line. Save and come back to add more.</p>
        </div>
      </Card>

      <Card title="Notes">
        <div className="grid gap-4">
          <Field label="Useful notes">
            <TextArea name="notes" defaultValue={v("notes") as string} />
          </Field>
          <Field label="Future opportunity">
            <TextArea name="future_opportunity" defaultValue={v("future_opportunity") as string} />
          </Field>
        </div>
      </Card>

      <div className="flex gap-3">
        <button type="submit" className={primaryButton}>
          {retainer ? "Save changes" : "Add retainer"}
        </button>
        <Link href={cancelHref} className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

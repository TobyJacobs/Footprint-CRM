import Link from "next/link";
import { Card, Checkbox, Field, Select, TextArea, TextInput, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import {
  billingFrequencies, emailPlatforms, hostingPlanTypes, hostingStatuses, includedHours, renewalMonths, webHostingPlans,
} from "@/lib/customers/options";

type Item = {
  kind: string;
  plan: string | null;
  domain: string | null;
  included_hours: string | null;
  on_20i: boolean;
  mailbox_qty: number | null;
  email_platform: string | null;
  footprint_hosted: boolean | null;
};
type Plan = Record<string, unknown> & { hosting_items?: Item[] };

export default function HostingForm({
  plan,
  action,
  cancelHref,
}: {
  plan?: Plan;
  action: (fd: FormData) => Promise<void>;
  cancelHref: string;
}) {
  const v = (k: string) => (plan?.[k] as string | number | null | undefined) ?? null;
  const items = plan?.hosting_items ?? [];
  // Existing lines plus some empty ones to fill in.
  const web = [...items.filter((i) => i.kind === "web"), ...Array.from({ length: 2 }, () => null)];
  const email = [...items.filter((i) => i.kind === "email"), null];

  return (
    <form action={action} className="grid max-w-4xl gap-6">
      <Card title="Plan">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" wide>
            <TextInput name="name" defaultValue={v("name")} required placeholder="e.g. Website hosting" />
          </Field>
          <Field label="Plan">
            <Select name="plan_type" options={hostingPlanTypes} defaultValue={v("plan_type") as string} />
          </Field>
          <Field label="Status">
            <Select name="status" options={hostingStatuses} defaultValue={(v("status") as string) ?? (plan ? null : "Active")} />
          </Field>
          <Field label="Price (£)">
            <TextInput name="price" type="number" step="0.01" defaultValue={v("price")} />
          </Field>
          <Field label="Billing frequency">
            <Select name="billing_frequency" options={billingFrequencies} defaultValue={v("billing_frequency") as string} />
          </Field>
          <Field label="Domain / SSL renewal month">
            <Select name="renewal_month" options={renewalMonths} defaultValue={v("renewal_month") as string} />
          </Field>
          <Field label="Direct Debit">
            <TextInput name="direct_debit" defaultValue={v("direct_debit")} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox name="hours_included" label="Support hours included" defaultChecked={plan?.hours_included as boolean} />
          </div>
        </div>
      </Card>

      <Card title="Web hosting">
        <div className="grid gap-3">
          {web.map((i, n) => (
            <div key={n} className="grid gap-2 rounded-md border border-fp-border p-3 sm:grid-cols-[1.4fr_1.2fr_0.8fr_auto] sm:items-end">
              <Field label="Domain">
                <input name={`web_${n}_domain`} defaultValue={i?.domain ?? ""} className={inputClass} placeholder="example.co.uk" />
              </Field>
              <Field label="Hosting">
                <Select name={`web_${n}_plan`} options={webHostingPlans} defaultValue={i?.plan} />
              </Field>
              <Field label="Included hours">
                <Select name={`web_${n}_hours`} options={includedHours} defaultValue={i?.included_hours} />
              </Field>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" name={`web_${n}_on20i`} defaultChecked={i?.on_20i ?? false} className="accent-fp-pink" />
                On 20i
              </label>
            </div>
          ))}
          <p className="text-xs text-fp-mid">Leave a line empty to remove it. Save and come back to add more lines.</p>
        </div>
      </Card>

      <Card title="Email hosting">
        <div className="grid gap-3">
          {email.map((i, n) => (
            <div key={n} className="grid gap-2 rounded-md border border-fp-border p-3 sm:grid-cols-3 sm:items-end">
              <Field label="Mailboxes">
                <input name={`email_${n}_qty`} type="number" defaultValue={i?.mailbox_qty ?? ""} className={inputClass} />
              </Field>
              <Field label="Platform">
                <Select name={`email_${n}_platform`} options={emailPlatforms} defaultValue={i?.email_platform} />
              </Field>
              <Field label="Hosted by Footprint?">
                <Select
                  name={`email_${n}_footprint`}
                  options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
                  defaultValue={i?.footprint_hosted === true ? "yes" : i?.footprint_hosted === false ? "no" : null}
                />
              </Field>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Access">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hosting platform">
            <TextInput name="hosting_platform" defaultValue={v("hosting_platform")} />
          </Field>
          <Field label="Admin URL">
            <TextInput name="admin_url" defaultValue={v("admin_url")} />
          </Field>
          <Field label="3rd party platform URL">
            <TextInput name="third_party_url" defaultValue={v("third_party_url")} />
          </Field>
          <Field label="3rd party username">
            <TextInput name="third_party_username" defaultValue={v("third_party_username")} />
          </Field>
          <Field
            label="Where the login is kept"
            hint="Passwords are never stored here — keep them in the password manager and note where, e.g. “1Password: Client – hosting”."
            wide
          >
            <TextInput name="credentials_location" defaultValue={v("credentials_location")} />
          </Field>
          <Field label="Other information" wide>
            <TextArea name="notes" defaultValue={v("notes") as string} />
          </Field>
        </div>
      </Card>

      <div className="flex gap-3">
        <button type="submit" className={primaryButton}>
          {plan ? "Save changes" : "Add hosting plan"}
        </button>
        <Link href={cancelHref} className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

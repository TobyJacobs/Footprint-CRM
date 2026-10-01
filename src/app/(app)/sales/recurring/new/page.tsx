import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getStaffOptions } from "@/lib/customers/staff";
import { getCustomerWithContacts, getTaxRates } from "@/lib/sales/data";
import { frequencyFromHosting } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";
import type { EditorLine } from "../../DocumentEditor";
import { saveRecurring } from "../actions";
import RecurringForm from "../RecurringForm";

export const metadata: Metadata = { title: "New recurring invoice" };

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

// Can be started blank, for a customer, or from a hosting plan / retainer
// (which fills in the customer, price and frequency).
export default async function NewRecurringPage(props: PageProps<"/sales/recurring/new">) {
  const user = await requirePermission("quotes", "edit");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [taxRates, staff] = await Promise.all([getTaxRates(), getStaffOptions()]);
  const vat = taxRates[0];

  let customerId: string | null = isId(sp.customer) ? sp.customer : null;
  let name: string | null = null;
  let frequency = "monthly";
  let businessUnit: string | null = null;
  const lines: EditorLine[] = [];

  if (isId(sp.hosting)) {
    const { data: plan } = await supabase.from("hosting_plans").select("*").eq("id", sp.hosting).maybeSingle();
    if (plan) {
      customerId = plan.customer_id;
      name = plan.name;
      frequency = frequencyFromHosting(plan.billing_frequency);
      lines.push({
        key: "hosting",
        product_id: null,
        description: [plan.name, plan.plan_type].filter(Boolean).join(" — "),
        quantity: 1,
        unit_price: Number(plan.price ?? 0),
        unit_cost: null,
        discount_percent: 0,
        tax_rate_id: vat?.id ?? null,
        tax_rate: vat?.rate ?? 0,
      });
    }
  }
  if (isId(sp.retainer)) {
    const { data: retainer } = await supabase.from("retainers").select("*, retainer_services(service, qty_per_month)").eq("id", sp.retainer).maybeSingle();
    if (retainer) {
      customerId = retainer.customer_id;
      name = retainer.name;
      businessUnit = "Digital";
      const services = (retainer.retainer_services ?? []) as { service: string; qty_per_month: number | null }[];
      lines.push({
        key: "retainer",
        product_id: null,
        description: [retainer.name, services.map((s) => (s.qty_per_month ? `${s.service} ×${s.qty_per_month}` : s.service)).join(", ")]
          .filter(Boolean)
          .join(" — "),
        quantity: 1,
        unit_price: Number(retainer.monthly_fee ?? 0),
        unit_cost: null,
        discount_percent: 0,
        tax_rate_id: vat?.id ?? null,
        tax_rate: vat?.rate ?? 0,
      });
    }
  }

  const picked = customerId ? await getCustomerWithContacts(customerId) : { customer: null, contacts: [] };
  const firstOfNextMonth = new Date();
  firstOfNextMonth.setMonth(firstOfNextMonth.getMonth() + 1, 1);

  return (
    <>
      <Link href="/sales/recurring" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Recurring invoices
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">New recurring invoice</h2>
      <Notice searchParams={sp} />
      <RecurringForm
        lines={lines}
        customer={picked.customer}
        contacts={picked.contacts}
        taxRates={taxRates}
        staff={staff}
        defaults={{
          name,
          frequency,
          next_date: firstOfNextMonth.toISOString().slice(0, 10),
          owner_id: user.id,
          hosting_plan_id: isId(sp.hosting) ? sp.hosting : null,
          retainer_id: isId(sp.retainer) ? sp.retainer : null,
          business_unit: businessUnit,
        }}
        action={saveRecurring.bind(null, null)}
        cancelHref="/sales/recurring"
      />
    </>
  );
}

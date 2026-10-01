import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getStaffOptions } from "@/lib/customers/staff";
import { getCustomerWithContacts, getRecurringLines, getTaxRates } from "@/lib/sales/data";
import { createClient } from "@/lib/supabase/server";
import { saveRecurring } from "../../actions";
import RecurringForm from "../../RecurringForm";

export const metadata: Metadata = { title: "Edit recurring invoice" };

export default async function EditRecurringPage(props: PageProps<"/sales/recurring/[recurringId]/edit">) {
  await requirePermission("quotes", "edit");
  const { recurringId } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: r } = await supabase.from("recurring_invoices").select("*").eq("id", recurringId).maybeSingle();
  if (!r) notFound();
  const [taxRates, staff, lines, picked] = await Promise.all([
    getTaxRates(),
    getStaffOptions(),
    getRecurringLines(recurringId),
    getCustomerWithContacts(r.customer_id),
  ]);
  return (
    <>
      <Link href={`/sales/recurring/${recurringId}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Back to {r.name}
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">Edit recurring invoice</h2>
      <Notice searchParams={sp} />
      <RecurringForm
        recurring={r}
        lines={lines}
        customer={picked.customer}
        contacts={picked.contacts}
        taxRates={taxRates}
        staff={staff}
        defaults={{ next_date: r.next_date }}
        action={saveRecurring.bind(null, recurringId)}
        cancelHref={`/sales/recurring/${recurringId}`}
      />
    </>
  );
}

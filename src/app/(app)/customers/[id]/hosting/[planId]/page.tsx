import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import PageHeader from "@/components/PageHeader";
import { Notice, dangerButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteHostingPlan, saveHostingPlan } from "../../../actions";
import HostingForm from "../HostingForm";

export const metadata: Metadata = { title: "Edit hosting plan" };

export default async function EditHostingPage(props: PageProps<"/customers/[id]/hosting/[planId]">) {
  const user = await requirePermission("customers", "edit");
  const { id, planId } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const [{ data: customer }, { data: plan }] = await Promise.all([
    supabase.from("customers").select("name").eq("id", id).maybeSingle(),
    supabase.from("hosting_plans").select("*, hosting_items(*)").eq("id", planId).eq("customer_id", id).maybeSingle(),
  ]);
  if (!customer || !plan) notFound();

  return (
    <>
      <PageHeader title={plan.name} intro={customer.name} />
      <div className="px-6 py-8 lg:px-10">
        <Link href={`/customers/${id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to {customer.name}
        </Link>
        <div className="mt-4">
          <Notice searchParams={searchParams} />
          <HostingForm plan={plan} action={saveHostingPlan.bind(null, id, planId)} cancelHref={`/customers/${id}`} />
        </div>
        {user.can("customers", "delete") && (
          <form action={deleteHostingPlan.bind(null, id, planId)} className="mt-10 max-w-4xl border-t border-fp-border pt-6">
            <ConfirmSubmit className={dangerButton} message={`Delete the hosting plan "${plan.name}"?`}>
              Delete hosting plan
            </ConfirmSubmit>
          </form>
        )}
      </div>
    </>
  );
}

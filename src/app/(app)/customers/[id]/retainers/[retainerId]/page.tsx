import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import PageHeader from "@/components/PageHeader";
import { Notice, dangerButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getStaffOptions } from "@/lib/customers/staff";
import { createClient } from "@/lib/supabase/server";
import { deleteRetainer, saveRetainer } from "../../../actions";
import RetainerForm from "../RetainerForm";

export const metadata: Metadata = { title: "Edit retainer" };

export default async function EditRetainerPage(props: PageProps<"/customers/[id]/retainers/[retainerId]">) {
  const user = await requirePermission("customers", "edit");
  const { id, retainerId } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const [{ data: customer }, { data: retainer }, staff] = await Promise.all([
    supabase.from("customers").select("name").eq("id", id).maybeSingle(),
    supabase.from("retainers").select("*, retainer_services(*)").eq("id", retainerId).eq("customer_id", id).maybeSingle(),
    getStaffOptions(),
  ]);
  if (!customer || !retainer) notFound();

  return (
    <>
      <PageHeader title={retainer.name} intro={customer.name} />
      <div className="px-6 py-8 lg:px-10">
        <Link href={`/customers/${id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to {customer.name}
        </Link>
        <div className="mt-4">
          <Notice searchParams={searchParams} />
          <RetainerForm
            retainer={retainer}
            staff={staff}
            action={saveRetainer.bind(null, id, retainerId)}
            cancelHref={`/customers/${id}`}
          />
        </div>
        {user.can("customers", "delete") && (
          <form action={deleteRetainer.bind(null, id, retainerId)} className="mt-10 max-w-4xl border-t border-fp-border pt-6">
            <ConfirmSubmit className={dangerButton} message={`Delete the retainer "${retainer.name}"?`}>
              Delete retainer
            </ConfirmSubmit>
          </form>
        )}
      </div>
    </>
  );
}

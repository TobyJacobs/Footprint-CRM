import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import PageHeader from "@/components/PageHeader";
import { Notice, dangerButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getStaffOptions } from "@/lib/customers/staff";
import { createClient } from "@/lib/supabase/server";
import { deleteCustomer, eraseCustomer, saveCustomer } from "../../actions";
import CustomerForm from "../../CustomerForm";
import DataProtectionCard from "../../DataProtectionCard";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage(props: PageProps<"/customers/[id]/edit">) {
  const user = await requirePermission("customers", "edit");
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const [{ data: customer }, staff] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    getStaffOptions(),
  ]);
  if (!customer) notFound();

  return (
    <>
      <PageHeader title={`Edit ${customer.name}`} />
      <div className="px-6 py-8 lg:px-10">
        <Link href={`/customers/${id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to {customer.name}
        </Link>
        <div className="mt-4">
          <Notice searchParams={searchParams} />
          <CustomerForm
            customer={customer}
            staff={staff}
            action={saveCustomer.bind(null, id)}
            cancelHref={`/customers/${id}`}
          />
        </div>

        {user.isAdmin && (
          <div className="mt-10 max-w-4xl">
            <DataProtectionCard
              subject={customer.name}
              kind="customer"
              exportHref={`/customers/${id}/export`}
              eraseAction={eraseCustomer.bind(null, id)}
              erasedAt={customer.erased_at}
            />
          </div>
        )}
        {user.can("customers", "delete") && (
          <form action={deleteCustomer.bind(null, id)} className="mt-10 max-w-4xl border-t border-fp-border pt-6">
            <p className="mb-3 text-sm text-fp-dark/75">
              Deleting a customer also deletes its contacts, hosting plans, retainers and timeline. This can&apos;t
              be undone from the platform (it is recorded in the audit log).
            </p>
            <ConfirmSubmit
              className={dangerButton}
              message={`Delete ${customer.name} and everything linked to it? This can't be undone.`}
            >
              Delete customer
            </ConfirmSubmit>
          </form>
        )}
      </div>
    </>
  );
}

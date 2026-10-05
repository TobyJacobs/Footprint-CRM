import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getStaffOptions } from "@/lib/customers/staff";
import { saveCustomer } from "../actions";
import CustomerForm from "../CustomerForm";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage(props: PageProps<"/customers/new">) {
  const user = await requirePermission("customers", "edit");
  const searchParams = await props.searchParams;
  const staff = await getStaffOptions();

  return (
    <>
      <PageHeader title="New customer" />
      <div className="px-6 py-8 lg:px-10">
        <Link href="/customers" className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← All customers
        </Link>
        <div className="mt-4">
          <Notice searchParams={searchParams} />
          <CustomerForm staff={staff} action={saveCustomer.bind(null, null)} cancelHref="/customers" defaultOwnerId={user.id} />
        </div>
      </div>
    </>
  );
}

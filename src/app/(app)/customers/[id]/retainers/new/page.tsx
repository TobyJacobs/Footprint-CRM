import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getStaffOptions } from "@/lib/customers/staff";
import { createClient } from "@/lib/supabase/server";
import { saveRetainer } from "../../../actions";
import RetainerForm from "../RetainerForm";

export const metadata: Metadata = { title: "New retainer" };

export default async function NewRetainerPage(props: PageProps<"/customers/[id]/retainers/new">) {
  await requirePermission("customers", "edit");
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const [{ data: customer }, staff] = await Promise.all([
    supabase.from("customers").select("name").eq("id", id).maybeSingle(),
    getStaffOptions(),
  ]);
  if (!customer) notFound();

  return (
    <>
      <PageHeader title="New digital retainer" intro={customer.name} />
      <div className="px-6 py-8 lg:px-10">
        <Link href={`/customers/${id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to {customer.name}
        </Link>
        <div className="mt-4">
          <Notice searchParams={searchParams} />
          <RetainerForm staff={staff} action={saveRetainer.bind(null, id, null)} cancelHref={`/customers/${id}`} />
        </div>
      </div>
    </>
  );
}

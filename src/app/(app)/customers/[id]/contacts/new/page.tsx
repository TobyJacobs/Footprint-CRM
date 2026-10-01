import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveContact } from "../../../actions";
import ContactForm from "../ContactForm";

export const metadata: Metadata = { title: "New contact" };

export default async function NewContactPage(props: PageProps<"/customers/[id]/contacts/new">) {
  await requirePermission("customers", "edit");
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("name").eq("id", id).maybeSingle();
  if (!customer) notFound();

  return (
    <>
      <PageHeader title="New contact" intro={customer.name} />
      <div className="px-6 py-8 lg:px-10">
        <Link href={`/customers/${id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to {customer.name}
        </Link>
        <div className="mt-4">
          <Notice searchParams={searchParams} />
          <ContactForm action={saveContact.bind(null, id, null)} cancelHref={`/customers/${id}`} />
        </div>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import PageHeader from "@/components/PageHeader";
import { Notice, dangerButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { personName } from "@/lib/customers/display";
import { createClient } from "@/lib/supabase/server";
import { deleteContact, saveContact } from "../../../actions";
import ContactForm from "../ContactForm";

export const metadata: Metadata = { title: "Edit contact" };

export default async function EditContactPage(props: PageProps<"/customers/[id]/contacts/[contactId]">) {
  const user = await requirePermission("customers", "edit");
  const { id, contactId } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const [{ data: customer }, { data: contact }] = await Promise.all([
    supabase.from("customers").select("name").eq("id", id).maybeSingle(),
    supabase.from("contacts").select("*").eq("id", contactId).eq("customer_id", id).maybeSingle(),
  ]);
  if (!customer || !contact) notFound();

  return (
    <>
      <PageHeader title={personName(contact)} intro={customer.name} />
      <div className="px-6 py-8 lg:px-10">
        <Link href={`/customers/${id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to {customer.name}
        </Link>
        <div className="mt-4">
          <Notice searchParams={searchParams} />
          <ContactForm contact={contact} action={saveContact.bind(null, id, contactId)} cancelHref={`/customers/${id}`} />
        </div>
        {user.can("customers", "delete") && (
          <form action={deleteContact.bind(null, id, contactId)} className="mt-10 max-w-3xl border-t border-fp-border pt-6">
            <ConfirmSubmit className={dangerButton} message={`Delete ${personName(contact)}? This can't be undone.`}>
              Delete contact
            </ConfirmSubmit>
          </form>
        )}
      </div>
    </>
  );
}

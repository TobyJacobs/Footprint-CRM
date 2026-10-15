import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { isDateIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { saveContent } from "../../actions";
import ContentForm from "../ContentForm";

export const metadata: Metadata = { title: "New content" };

export default async function NewContentPage(props: PageProps<"/marketing/content/new">) {
  await requirePermission("marketing", "edit");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: people } = await supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name");

  // Arriving from the calendar or a client pre-fills the date and client.
  const customerId = typeof sp.customer === "string" ? sp.customer : null;
  const { data: customer } = customerId
    ? await supabase.from("customers").select("id, name").eq("id", customerId).maybeSingle()
    : { data: null };
  const back = typeof sp.back === "string" && sp.back.startsWith("/marketing") ? sp.back : "/marketing/content";

  return (
    <>
      <Link href={back} className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Back
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">New content</h2>
      <Notice searchParams={sp} />
      <ContentForm
        action={saveContent.bind(null, null)}
        people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email }))}
        values={{
          customer: customer ? { id: customer.id, name: customer.name } : null,
          publish_date: isDateIso(sp.date) ? sp.date : null,
        }}
        back={back}
        submitLabel="Add to calendar"
      />
    </>
  );
}

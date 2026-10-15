import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveCampaign } from "../../actions";
import CampaignForm from "../CampaignForm";

export const metadata: Metadata = { title: "New ad campaign" };

export default async function NewCampaignPage(props: PageProps<"/marketing/campaigns/new">) {
  await requirePermission("marketing", "edit");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: people } = await supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name");

  const customerId = typeof sp.customer === "string" ? sp.customer : null;
  const { data: customer } = customerId
    ? await supabase.from("customers").select("id, name").eq("id", customerId).maybeSingle()
    : { data: null };

  return (
    <>
      <Link href="/marketing/campaigns" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Ad campaigns
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">New ad campaign</h2>
      <Notice searchParams={sp} />
      <CampaignForm
        action={saveCampaign.bind(null, null)}
        people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email }))}
        values={{ customer: customer ? { id: customer.id, name: customer.name } : null }}
        submitLabel="Add campaign"
      />
    </>
  );
}

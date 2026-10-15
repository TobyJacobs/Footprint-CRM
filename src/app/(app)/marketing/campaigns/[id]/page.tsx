import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Notice, dangerButton } from "@/components/ui";
import { getCurrentUser, requirePermission } from "@/lib/auth";
import { shortDateTime } from "@/lib/customers/display";
import { createClient } from "@/lib/supabase/server";
import { deleteCampaign, saveCampaign } from "../../actions";
import CampaignForm from "../CampaignForm";

export const metadata: Metadata = { title: "Ad campaign" };

export default async function CampaignPage(props: PageProps<"/marketing/campaigns/[id]">) {
  await requirePermission("marketing", "edit");
  const user = await getCurrentUser();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: campaign }, { data: people }] = await Promise.all([
    supabase
      .from("ad_campaigns")
      .select("id, name, platform, status, start_date, end_date, budget, spend, spend_updated_at, leads, results, owner_id, notes, customers(id, name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
  ]);
  if (!campaign) notFound();
  const customer = campaign.customers as unknown as { id: string; name: string } | null;

  return (
    <>
      <Link href="/marketing/campaigns" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Ad campaigns
      </Link>
      <h2 className="mb-1 mt-3 text-xl font-black">{campaign.name}</h2>
      {campaign.spend_updated_at && <p className="text-sm text-fp-mid">Spend last updated {shortDateTime(campaign.spend_updated_at)}</p>}
      <div className="mt-4">
        <Notice searchParams={sp} />
      </div>
      <CampaignForm
        action={saveCampaign.bind(null, campaign.id)}
        people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email }))}
        values={{ ...campaign, budget: campaign.budget === null ? null : Number(campaign.budget), spend: Number(campaign.spend), customer }}
        submitLabel="Save changes"
      />
      {user.can("marketing", "delete") && (
        <form action={deleteCampaign.bind(null, campaign.id)} className="mt-6">
          <ConfirmSubmit message="Delete this ad campaign?" className={dangerButton}>
            Delete
          </ConfirmSubmit>
        </form>
      )}
    </>
  );
}

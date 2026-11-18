"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { num, int, str } from "@/lib/forms";
import { adPlatforms, campaignStatuses, contentChannels, contentStatuses } from "@/lib/marketing/options";
import { isDateIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: string | null) => (v && UUID_RE.test(v) ? v : null);
const date = (v: string | null) => (v && isDateIso(v) ? v : null);

// Only ever send people back to a page inside Marketing.
const safeBack = (v: string | null, fallback: string) => (v && v.startsWith("/marketing") && !v.startsWith("//") ? v : fallback);
const withFlag = (path: string, flag: string) => `${path}${path.includes("?") ? "&" : "?"}${flag}=1`;

// Links must be ordinary web addresses.
function webLink(v: string | null, back: string): string | null {
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    return u.toString();
  } catch {
    fail(back, "That link doesn't look like a web address");
  }
}

// Link new work to the client's live retainer automatically, when they have exactly one.
async function liveRetainer(supabase: Awaited<ReturnType<typeof createClient>>, customerId: string | null) {
  if (!customerId) return null;
  const { data } = await supabase.from("retainers").select("id").eq("customer_id", customerId).eq("status", "Live").limit(2);
  return data?.length === 1 ? (data[0].id as string) : null;
}

// ─── Content calendar ───────────────────────────────────────────────────────

export async function saveContent(itemId: string | null, fd: FormData) {
  const user = await requirePermission("marketing", "edit");
  const back = itemId ? `/marketing/content/${itemId}` : "/marketing/content/new";
  const title = str(fd, "title");
  const channel = str(fd, "channel");
  const status = str(fd, "status") ?? "idea";
  if (!title) fail(back, "Please give the content a title");
  if (!channel || !contentChannels.includes(channel as (typeof contentChannels)[number])) fail(back, "Please choose a channel");
  if (!contentStatuses.some((s) => s.value === status)) fail(back, "Unknown status");

  const supabase = await createClient();
  const customerId = uuid(str(fd, "customer_id"));
  const fields = {
    title,
    channel,
    status,
    customer_id: customerId,
    retainer_id: await liveRetainer(supabase, customerId),
    publish_date: date(str(fd, "publish_date")),
    assignee_id: uuid(str(fd, "assignee_id")) ?? (itemId ? null : user.id),
    link: webLink(str(fd, "link"), back),
    notes: str(fd, "notes"),
  };

  const { error } = itemId
    ? await supabase.from("content_items").update(fields).eq("id", itemId)
    : await supabase.from("content_items").insert(fields);
  if (error) fail(back, error.message);
  revalidatePath("/marketing", "layout");
  redirect(withFlag(safeBack(str(fd, "back"), "/marketing/content"), "saved"));
}

export async function setContentStatus(itemId: string, fd: FormData) {
  await requirePermission("marketing", "edit");
  const back = safeBack(str(fd, "back"), "/marketing/content");
  const status = str(fd, "status");
  if (!status || !contentStatuses.some((s) => s.value === status)) fail(back, "Unknown status");
  const supabase = await createClient();
  const { error } = await supabase.from("content_items").update({ status }).eq("id", itemId);
  if (error) fail(back, error.message);
  revalidatePath("/marketing", "layout");
  redirect(back);
}

export async function deleteContent(itemId: string) {
  await requirePermission("marketing", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("content_items").delete().eq("id", itemId);
  if (error) fail(`/marketing/content/${itemId}`, error.message);
  revalidatePath("/marketing", "layout");
  redirect("/marketing/content?deleted=1");
}

// ─── Ad campaigns ───────────────────────────────────────────────────────────

export async function saveCampaign(campaignId: string | null, fd: FormData) {
  const user = await requirePermission("marketing", "edit");
  const back = campaignId ? `/marketing/campaigns/${campaignId}` : "/marketing/campaigns/new";
  const name = str(fd, "name");
  const platform = str(fd, "platform");
  const status = str(fd, "status") ?? "planned";
  const customerId = uuid(str(fd, "customer_id"));
  if (!name) fail(back, "Please give the campaign a name");
  if (!customerId) fail(back, "Please choose the client");
  if (!platform || !adPlatforms.includes(platform as (typeof adPlatforms)[number])) fail(back, "Please choose a platform");
  if (!campaignStatuses.some((s) => s.value === status)) fail(back, "Unknown status");
  const budget = num(fd, "budget");
  const spend = num(fd, "spend") ?? 0;
  const leads = int(fd, "leads");
  if ((budget !== null && budget < 0) || spend < 0 || (leads !== null && leads < 0)) fail(back, "Amounts can't be negative");
  const start = date(str(fd, "start_date"));
  const end = date(str(fd, "end_date"));
  if (start && end && end < start) fail(back, "The end date is before the start date");

  const supabase = await createClient();
  const fields = {
    name,
    platform,
    status,
    customer_id: customerId,
    retainer_id: await liveRetainer(supabase, customerId),
    start_date: start,
    end_date: end,
    budget,
    leads,
    results: str(fd, "results"),
    owner_id: uuid(str(fd, "owner_id")) ?? user.id,
    notes: str(fd, "notes"),
  };

  let error;
  if (campaignId) {
    // Only re-stamp "spend updated" when the spend figure actually changed.
    const { data: before } = await supabase.from("ad_campaigns").select("spend").eq("id", campaignId).maybeSingle();
    const changed = !before || Number(before.spend) !== spend;
    ({ error } = await supabase
      .from("ad_campaigns")
      .update({ ...fields, spend, ...(changed ? { spend_updated_at: new Date().toISOString() } : {}) })
      .eq("id", campaignId));
  } else {
    ({ error } = await supabase.from("ad_campaigns").insert({ ...fields, spend, spend_updated_at: spend > 0 ? new Date().toISOString() : null }));
  }
  if (error) fail(back, error.message);
  revalidatePath("/marketing", "layout");
  redirect(withFlag(safeBack(str(fd, "back"), "/marketing/campaigns"), "saved"));
}

// Quick "spend so far" update from the campaigns list.
export async function updateSpend(campaignId: string, fd: FormData) {
  await requirePermission("marketing", "edit");
  const back = safeBack(str(fd, "back"), "/marketing/campaigns");
  const spend = num(fd, "spend");
  if (spend === null || spend < 0) fail(back, "Please enter the spend so far");
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_campaigns")
    .update({ spend, spend_updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  if (error) fail(back, error.message);
  revalidatePath("/marketing", "layout");
  redirect(withFlag(back, "saved"));
}

export async function deleteCampaign(campaignId: string) {
  await requirePermission("marketing", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("ad_campaigns").delete().eq("id", campaignId);
  if (error) fail(`/marketing/campaigns/${campaignId}`, error.message);
  revalidatePath("/marketing", "layout");
  redirect("/marketing/campaigns?deleted=1");
}

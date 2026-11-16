"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { commissionAreas, parseBands } from "@/lib/commission";
import { createClient } from "@/lib/supabase/server";

const BACK = "/reports/commission/settings";
const fail = (m: string): never => redirect(`${BACK}?error=${encodeURIComponent(m)}`);
const UUID = /^[0-9a-f-]{36}$/i;

async function allowed() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_see_commission");
  if (data !== true) fail("Only Directors and commission viewers can change commission");
  return supabase;
}

// Add or change a target and its bands (Directors and commission viewers; the
// database checks too).
export async function saveCommissionTarget(id: string | null, fd: FormData) {
  const supabase = await allowed();
  const staffId = String(fd.get("staff_id") ?? "");
  const label = String(fd.get("label") ?? "").trim().slice(0, 120);
  const measure = String(fd.get("measure") ?? "");
  const scope = String(fd.get("scope") ?? "own");
  const payout = String(fd.get("payout") ?? "");
  const target = Number(String(fd.get("target") ?? "").replace(/[£,\s]/g, ""));
  const units = fd.getAll("business_units").map(String).filter((u) => commissionAreas.includes(u));
  const bands = parseBands(String(fd.get("bands") ?? ""));
  if (!UUID.test(staffId)) fail("Please choose the person");
  if (!label) fail("Please give the target a name");
  if (!["revenue", "gp"].includes(measure) || !["own", "group"].includes(scope) || !["percent", "fixed"].includes(payout)) fail("Please fill in every choice");
  if (!(target > 0)) fail("Please enter the target in pounds");
  if (!bands || !bands.length) fail('Please enter the bands one per line, like "100 = 10"');

  const row = { staff_id: staffId, label, measure, scope, payout, target, business_units: units, active: fd.get("active") === "on", position: Number(fd.get("position") ?? 0) || 0 };
  let targetId = id;
  if (id) {
    const { error } = await supabase.from("commission_targets").update(row).eq("id", id);
    if (error) fail(error.message);
  } else {
    const { data, error } = await supabase.from("commission_targets").insert(row).select("id").single();
    if (error) fail(error.message);
    targetId = data!.id;
  }
  const { error: delError } = await supabase.from("commission_bands").delete().eq("target_id", targetId!);
  if (delError) fail(delError.message);
  const { error: bandError } = await supabase.from("commission_bands").insert(bands!.map((b) => ({ ...b, target_id: targetId })));
  if (bandError) fail(bandError.message);
  revalidatePath("/reports/commission", "layout");
  redirect(`${BACK}?saved=1`);
}

export async function deleteCommissionTarget(id: string) {
  const supabase = await allowed();
  const { error } = await supabase.from("commission_targets").delete().eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/reports/commission", "layout");
  redirect(`${BACK}?deleted=1`);
}

// Who else can see commission (Directors only; the database checks too).
export async function addCommissionViewer(fd: FormData) {
  const supabase = await allowed();
  const profileId = String(fd.get("profile_id") ?? "");
  if (!UUID.test(profileId)) fail("Please choose a person");
  const { error } = await supabase.from("commission_viewers").insert({ profile_id: profileId });
  if (error) fail(error.code === "42501" ? "Only Directors can choose who sees commission" : error.message);
  revalidatePath("/reports", "layout");
  redirect(`${BACK}?saved=1`);
}

export async function removeCommissionViewer(profileId: string) {
  const supabase = await allowed();
  const { error, count } = await supabase.from("commission_viewers").delete({ count: "exact" }).eq("profile_id", profileId);
  if (error) fail(error.message);
  if (!count) fail("Only Directors can choose who sees commission");
  revalidatePath("/reports", "layout");
  redirect(`${BACK}?saved=1`);
}

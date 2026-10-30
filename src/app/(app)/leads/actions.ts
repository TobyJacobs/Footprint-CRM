"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { int, num, str } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Lead pipelines. Everything runs as the signed-in person, so the database
// decides what they may see and change (see the lead_pipelines migration).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: string | null) => (v && UUID_RE.test(v) ? v : null);
const safeBack = (v: string | null) => (v && /^\/leads(\/|\?|$)/.test(v) && !v.startsWith("//") ? v : "/leads");
const withParam = (path: string, q: string) => `${path}${path.includes("?") ? "&" : "?"}${q}`;

async function needEdit(back: string) {
  const user = await getCurrentUser();
  if (!user.can("marketing", "edit") && !user.can("quotes", "edit")) fail(back, "You can't change leads");
  return user;
}
function fail(back: string, message: string): never {
  redirect(withParam(back, `error=${encodeURIComponent(message)}`));
}
function done(back: string): never {
  revalidatePath("/leads", "layout");
  redirect(back);
}

export async function saveLead(id: string | null, fd: FormData) {
  const back = safeBack(str(fd, "back"));
  const user = await needEdit(back);
  const name = str(fd, "name");
  const pipeline = uuid(str(fd, "pipeline_id"));
  const stage = uuid(str(fd, "stage_id"));
  if (!name || !pipeline || !stage) fail(back, "Please give the lead a name and stage");
  const fields = {
    pipeline_id: pipeline,
    stage_id: stage,
    name: name.slice(0, 200),
    company: str(fd, "company")?.slice(0, 200) ?? null,
    email: str(fd, "email")?.slice(0, 320) ?? null,
    phone: str(fd, "phone")?.slice(0, 50) ?? null,
    source: str(fd, "source"),
    value_estimate: num(fd, "value_estimate"),
    owner_id: uuid(str(fd, "owner_id")) ?? (id ? null : user.id),
    next_follow_up: str(fd, "next_follow_up"),
    notes: str(fd, "notes")?.slice(0, 5000) ?? null,
    lost_reason: str(fd, "lost_reason"),
  };
  const supabase = await createClient();
  if (!id) {
    const { error } = await supabase.from("leads").insert(fields);
    if (error) fail(back, error.message);
    done(withParam(back.replace(/([?&])add=1/, "$1").replace(/[?&]$/, ""), "saved=1"));
  }
  const { data, error } = await supabase.from("leads").update(fields).eq("id", id).select("id");
  if (error) fail(back, error.message);
  if (!data?.length) fail(back, "You can't change that lead");
  done(withParam(back, "saved=1"));
}

// Drag a card onto another stage column.
export async function moveLead(id: string, stageId: string, back: string) {
  const to = safeBack(back);
  await needEdit(to);
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").update({ stage_id: stageId }).eq("id", id).select("id");
  if (error) fail(to, error.message);
  if (!data?.length) fail(to, "You can't move that lead");
  done(to);
}

export async function deleteLead(id: string, fd: FormData) {
  const back = safeBack(str(fd, "back"));
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").delete().eq("id", id).select("id");
  if (error) fail(back, error.message);
  if (!data?.length) fail(back, "You can't delete that lead");
  done(withParam(back.replace(/([?&])open=[^&]*/, "$1").replace(/[?&]$/, ""), "deleted=1"));
}

// Ready to quote: link the lead to a customer (an existing one with the same
// email, or a new one with the lead as its first contact), move it to the
// "Quote sent" stage and open a new quote for that customer.
export async function quoteFromLead(id: string, fd: FormData) {
  const back = safeBack(str(fd, "back"));
  const user = await getCurrentUser();
  if (!user.can("customers", "edit") || !user.can("quotes", "edit")) fail(back, "Making a customer and quote needs Customers and Sales access");
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*, lead_pipelines(business_unit)").eq("id", id).maybeSingle();
  if (!lead) fail(back, "Lead not found");

  let customerId: string | null = lead.customer_id;
  if (!customerId && lead.email) {
    const { data: match } = await supabase.from("contacts").select("customer_id").ilike("email", lead.email.trim()).not("customer_id", "is", null).limit(1);
    customerId = match?.[0]?.customer_id ?? null;
  }
  if (!customerId) {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({ name: lead.company || lead.name, phone: lead.phone, email: lead.email, owner_id: lead.owner_id ?? user.id, status: "Active" })
      .select("id")
      .single();
    if (error) fail(back, error.message);
    customerId = created.id;
    const parts = String(lead.name).trim().split(/\s+/);
    const last = parts.length > 1 ? parts.pop()! : parts[0];
    const { error: contactError } = await supabase.from("contacts").insert({
      customer_id: customerId,
      first_name: parts.length && parts[0] !== last ? parts.join(" ") : null,
      last_name: last,
      email: lead.email,
      phone: lead.phone,
      is_primary: true,
      lead_source: lead.source,
    });
    if (contactError) fail(back, contactError.message);
  }

  const { data: quoteStage } = await supabase
    .from("lead_stages")
    .select("id")
    .eq("pipeline_id", lead.pipeline_id)
    .ilike("name", "quote%")
    .limit(1);
  await supabase
    .from("leads")
    .update({ customer_id: customerId, ...(quoteStage?.[0] ? { stage_id: quoteStage[0].id } : {}) })
    .eq("id", id);
  revalidatePath("/leads", "layout");
  const unit = (lead.lead_pipelines as unknown as { business_unit: string | null } | null)?.business_unit;
  redirect(`/sales/new?type=quote&customer=${customerId}${unit === "Advertising" ? "&kind=advertising" : ""}`);
}

// ─── Pipeline set-up (Marketing edit) ───────────────────────────────────────

export async function saveStage(id: string, fd: FormData) {
  await needEdit("/leads/settings");
  const name = str(fd, "name");
  if (!name) fail("/leads/settings", "Each stage needs a name");
  const kind = ["open", "won", "lost"].includes(String(fd.get("kind"))) ? String(fd.get("kind")) : "open";
  const supabase = await createClient();
  const { error } = await supabase.from("lead_stages").update({ name, position: int(fd, "position") ?? 0, kind }).eq("id", id);
  if (error) fail("/leads/settings", error.message);
  done("/leads/settings?saved=1");
}

export async function addStage(pipelineId: string, fd: FormData) {
  await needEdit("/leads/settings");
  const name = str(fd, "name");
  if (!name) fail("/leads/settings", "Give the new stage a name");
  const supabase = await createClient();
  const { data: last } = await supabase.from("lead_stages").select("position").eq("pipeline_id", pipelineId).order("position", { ascending: false }).limit(1);
  const { error } = await supabase.from("lead_stages").insert({ pipeline_id: pipelineId, name, position: (last?.[0]?.position ?? 0) + 1, kind: "open" });
  if (error) fail("/leads/settings", error.message);
  done("/leads/settings?saved=1");
}

export async function deleteStage(id: string) {
  await needEdit("/leads/settings");
  const supabase = await createClient();
  const { error } = await supabase.from("lead_stages").delete().eq("id", id);
  if (error) fail("/leads/settings", error.message.includes("foreign key") ? "Move the leads out of that stage first" : error.message);
  done("/leads/settings?saved=1");
}

export async function addPipeline(fd: FormData) {
  await needEdit("/leads/settings");
  const name = str(fd, "name");
  if (!name) fail("/leads/settings", "Give the pipeline a name");
  const supabase = await createClient();
  const { data: p, error } = await supabase.from("lead_pipelines").insert({ name, business_unit: str(fd, "business_unit") }).select("id").single();
  if (error) fail("/leads/settings", error.message);
  await supabase.from("lead_stages").insert(
    [
      ["New lead", "open"],
      ["Contacted", "open"],
      ["Meeting booked", "open"],
      ["Quote sent", "open"],
      ["Won", "won"],
      ["Lost", "lost"],
    ].map(([n, kind], i) => ({ pipeline_id: p.id, name: n, position: i + 1, kind })),
  );
  done("/leads/settings?saved=1");
}

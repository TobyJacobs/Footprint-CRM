"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isDirectoryConfigured } from "@/lib/entra/graph";
import { runDirectorySync } from "@/lib/entra/sync";
import { brandedHtml, isEmailConfigured, isEmailTestMode, sendEmail } from "@/lib/email/postmark";
import { dashboardTypes } from "@/lib/dashboards/data";
import { createClient } from "@/lib/supabase/server";
import { permissionFeatures, ACTIONS } from "./permissions";

// Every action here checks the user is an admin, and runs as that user, so
// the database's own rules are applied too.

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// Add and remove link rows so the set matches `wanted`, touching only what changed.
// For user roles, only roles added by hand are touched: roles that come from
// the person's Microsoft 365 job title are managed by the directory sync.
async function syncLinks(
  table: "user_roles" | "team_members",
  fixedColumn: "user_id" | "team_id",
  fixedId: string,
  otherColumn: "role_id" | "user_id" | "team_id",
  wanted: string[],
) {
  const supabase = await createClient();
  const isRoles = table === "user_roles";
  const { data: current, error } = await supabase
    .from(table)
    .select(isRoles ? `${otherColumn}, source` : otherColumn)
    .eq(fixedColumn, fixedId);
  if (error) throw error;

  const rows = (current ?? []) as unknown as Record<string, string>[];
  const managed = new Set(rows.filter((r) => r.source === "directory").map((r) => r[otherColumn]));
  const have = new Set(rows.filter((r) => r.source !== "directory").map((r) => r[otherColumn]));
  const want = new Set(wanted.filter((id) => !managed.has(id)));
  const toAdd = [...want].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));

  if (toAdd.length) {
    const { error: addError } = await supabase
      .from(table)
      .insert(toAdd.map((id) => ({ [fixedColumn]: fixedId, [otherColumn]: id })));
    if (addError) throw addError;
  }
  if (toRemove.length) {
    let remove = supabase.from(table).delete().eq(fixedColumn, fixedId).in(otherColumn, toRemove);
    if (isRoles) remove = remove.eq("source", "manual");
    const { error: removeError } = await remove;
    if (removeError) throw removeError;
  }
}

// ─── Company details & numbering ────────────────────────────────────────────

export async function saveCompanySettings(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const n = (name: string, fallback: number) => {
    const v = Number(text(formData, name));
    return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback;
  };
  const fields = {
    company_name: text(formData, "company_name") || "Footprint Group",
    legal_name: text(formData, "legal_name") || null,
    address: text(formData, "address") || null,
    phone: text(formData, "phone") || null,
    email: text(formData, "email") || null,
    website: text(formData, "website") || null,
    vat_number: text(formData, "vat_number") || null,
    company_number: text(formData, "company_number") || null,
    bank_details: text(formData, "bank_details") || null,
    quote_terms: text(formData, "quote_terms") || null,
    order_terms: text(formData, "order_terms") || null,
    invoice_notes: text(formData, "invoice_notes") || null,
    invoice_terms: text(formData, "invoice_terms") || null,
    quote_valid_days: n("quote_valid_days", 30),
    invoice_due_days: n("invoice_due_days", 30),
  };
  const { error } = await supabase.from("company_settings").update(fields).eq("id", true);
  if (error) fail("/admin/company", error.message);

  // Next document numbers (only ever moved forwards, to avoid duplicates).
  const { data: seqs } = await supabase.from("number_sequences").select("doc_type, next_number");
  for (const s of seqs ?? []) {
    const wanted = Number(text(formData, `next_${s.doc_type}`));
    if (Number.isFinite(wanted) && wanted > Number(s.next_number)) {
      const { error: seqError } = await supabase
        .from("number_sequences")
        .update({ next_number: Math.round(wanted) })
        .eq("doc_type", s.doc_type);
      if (seqError) fail("/admin/company", seqError.message);
    }
  }

  revalidatePath("/admin/company");
  redirect("/admin/company?saved=1");
}

// ─── System ─────────────────────────────────────────────────────────────────

// Deliberately fails so an admin can check that error alerts reach Sentry.
export async function sendTestError() {
  await requireAdmin();
  throw new Error("Test error sent from Admin → System (this is expected)");
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function saveUser(userId: string, formData: FormData) {
  const me = await requireAdmin();
  const path = `/admin/users/${userId}`;
  const supabase = await createClient();

  if (userId !== me.id) {
    const { error } = await supabase
      .from("profiles")
      .update({
        is_active: formData.get("is_active") === "on",
        is_admin: formData.get("is_admin") === "on",
      })
      .eq("id", userId);
    if (error) fail(path, error.message);
  }

  try {
    await syncLinks("user_roles", "user_id", userId, "role_id", formData.getAll("roles").map(String));
    await syncLinks("team_members", "user_id", userId, "team_id", formData.getAll("teams").map(String));
  } catch (e) {
    fail(path, e instanceof Error ? e.message : "Couldn't save changes");
  }

  revalidatePath("/", "layout");
  redirect(`${path}?saved=1`);
}

// ─── Teams ──────────────────────────────────────────────────────────────────

export async function createTeam(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  if (!name) fail("/admin/teams", "Please give the team a name");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({ name, description: text(formData, "description") || null })
    .select("id")
    .single();
  if (error) fail("/admin/teams", error.code === "23505" ? "A team with that name already exists" : error.message);

  revalidatePath("/admin/teams");
  redirect(`/admin/teams/${data.id}`);
}

export async function saveTeam(teamId: string, formData: FormData) {
  await requireAdmin();
  const path = `/admin/teams/${teamId}`;
  const name = text(formData, "name");
  if (!name) fail(path, "Please give the team a name");

  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ name, description: text(formData, "description") || null })
    .eq("id", teamId);
  if (error) fail(path, error.code === "23505" ? "A team with that name already exists" : error.message);

  try {
    await syncLinks("team_members", "team_id", teamId, "user_id", formData.getAll("members").map(String));
  } catch (e) {
    fail(path, e instanceof Error ? e.message : "Couldn't save members");
  }

  revalidatePath("/admin/teams");
  redirect(`${path}?saved=1`);
}

export async function deleteTeam(teamId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) fail(`/admin/teams/${teamId}`, error.message);
  revalidatePath("/admin/teams");
  redirect("/admin/teams?deleted=1");
}

// ─── Roles ──────────────────────────────────────────────────────────────────

// Which home page dashboard a role gets (see lib/dashboards/data.ts).
function dashboardValue(formData: FormData) {
  const value = text(formData, "dashboard");
  return dashboardTypes.some((d) => d.value === value) ? value : "general";
}

export async function createRole(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  if (!name) fail("/admin/roles", "Please give the role a name");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .insert({
      name,
      description: text(formData, "description") || null,
      dashboard: dashboardValue(formData),
      own_records_only: formData.get("own_records_only") === "on",
    })
    .select("id")
    .single();
  if (error) fail("/admin/roles", error.code === "23505" ? "A role with that name already exists" : error.message);

  revalidatePath("/admin/roles");
  redirect(`/admin/roles/${data.id}`);
}

export async function saveRole(roleId: string, formData: FormData) {
  await requireAdmin();
  const path = `/admin/roles/${roleId}`;
  const name = text(formData, "name");
  if (!name) fail(path, "Please give the role a name");

  const supabase = await createClient();
  const { error } = await supabase
    .from("roles")
    .update({
      name,
      description: text(formData, "description") || null,
      dashboard: dashboardValue(formData),
      own_records_only: formData.get("own_records_only") === "on",
    })
    .eq("id", roleId);
  if (error) fail(path, error.code === "23505" ? "A role with that name already exists" : error.message);

  // Permissions arrive as "feature:action" checkbox values. Only accept known ones.
  const valid = new Set(
    permissionFeatures.flatMap((f) => ACTIONS.map((a) => `${f.key}:${a}`)),
  );
  const wanted = new Set(formData.getAll("perm").map(String).filter((p) => valid.has(p)));

  const { data: current, error: readError } = await supabase
    .from("role_permissions")
    .select("feature, action")
    .eq("role_id", roleId);
  if (readError) fail(path, readError.message);

  const have = new Set((current ?? []).map((p) => `${p.feature}:${p.action}`));
  const toAdd = [...wanted].filter((p) => !have.has(p));
  const toRemove = [...have].filter((p) => !wanted.has(p));

  if (toAdd.length) {
    const { error: addError } = await supabase.from("role_permissions").insert(
      toAdd.map((p) => {
        const [feature, action] = p.split(":");
        return { role_id: roleId, feature, action };
      }),
    );
    if (addError) fail(path, addError.message);
  }
  for (const p of toRemove) {
    const [feature, action] = p.split(":");
    const { error: removeError } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("feature", feature)
      .eq("action", action);
    if (removeError) fail(path, removeError.message);
  }

  revalidatePath("/", "layout");
  redirect(`${path}?saved=1`);
}

export async function deleteRole(roleId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("roles").delete().eq("id", roleId);
  if (error) fail(`/admin/roles/${roleId}`, error.message);
  revalidatePath("/", "layout");
  redirect("/admin/roles?deleted=1");
}

// ─── Microsoft 365 staff directory ──────────────────────────────────────────

export async function syncDirectoryNow() {
  await requireAdmin();
  if (!isDirectoryConfigured()) fail("/admin/directory", "Microsoft 365 sync isn't set up yet");
  const supabase = await createClient();
  const result = await runDirectorySync(supabase);
  if (!result.ok) fail("/admin/directory", result.error);
  revalidatePath("/admin", "layout");
  redirect(`/admin/directory?synced=${result.seen}&added=${result.added}&off=${result.switched_off}`);
}

async function reapplyRoles(path: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reapply_directory_roles");
  if (error) fail(path, error.message);
}

export async function addJobRoleRule(formData: FormData) {
  await requireAdmin();
  const matchText = text(formData, "match_text");
  const roleId = text(formData, "role_id");
  const priority = Number(text(formData, "priority")) || 100;
  if (!matchText || !roleId) fail("/admin/directory", "Please enter some job title text and pick a role");

  const supabase = await createClient();
  const { error } = await supabase.from("job_role_rules").insert({ match_text: matchText, role_id: roleId, priority });
  if (error) fail("/admin/directory", error.code === "23505" ? "That rule already exists" : error.message);
  await reapplyRoles("/admin/directory");
  revalidatePath("/admin", "layout");
  redirect("/admin/directory?saved=1");
}

export async function deleteJobRoleRule(ruleId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("job_role_rules").delete().eq("id", ruleId);
  if (error) fail("/admin/directory", error.message);
  await reapplyRoles("/admin/directory");
  revalidatePath("/admin", "layout");
  redirect("/admin/directory?deleted=1");
}

// Pick a role for one person (wins over the job title rules), or go back to
// "Automatic" (empty value).
export async function setDirectoryRole(directoryId: string, back: string, formData: FormData) {
  await requireAdmin();
  const safeBack = back.startsWith("/admin/") ? back : "/admin/users";
  const roleId = text(formData, "role_id") || null;
  const supabase = await createClient();
  const { error } = await supabase.from("staff_directory").update({ role_id: roleId }).eq("id", directoryId);
  if (error) fail(safeBack, error.message);
  await reapplyRoles(safeBack);
  revalidatePath("/admin", "layout");
  redirect(`${safeBack}?saved=1`);
}

// Creates the key the daily sync uses. Only its fingerprint is stored; the key
// is shown once so the admin can paste it into Netlify as DIRECTORY_SYNC_KEY.
export async function createDirectorySyncKey(): Promise<{ key?: string; error?: string }> {
  await requireAdmin();
  const key = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(key, "utf8").digest("hex");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_directory_sync_key_hash", { p_hash: hash });
  if (error) return { error: error.message };
  return { key };
}

// ─── Targets & commission ───────────────────────────────────────────────────

function amount(formData: FormData, name: string): number | null {
  const raw = text(formData, name).replace(/[£,%\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

// Set (or clear, when empty) one "every month" target.
async function upsertTarget(userId: string | null, metric: string, value: number | null, month: string | null = null) {
  const supabase = await createClient();
  let existing = supabase.from("monthly_targets").select("id").eq("metric", metric);
  existing = userId ? existing.eq("user_id", userId) : existing.is("user_id", null);
  existing = month ? existing.eq("month", month) : existing.is("month", null);
  const { data: row } = await existing.maybeSingle();
  if (value === null) {
    if (row) await supabase.from("monthly_targets").delete().eq("id", row.id);
    return null;
  }
  const { error } = row
    ? await supabase.from("monthly_targets").update({ amount: value, is_example: false }).eq("id", row.id)
    : await supabase.from("monthly_targets").insert({ user_id: userId, metric, month, amount: value, is_example: false });
  return error;
}

export async function saveGroupTargets(formData: FormData) {
  await requireAdmin();
  const path = "/admin/targets";
  const values = {
    invoiced: amount(formData, "invoiced"),
    gross_profit: amount(formData, "gross_profit"),
    margin_pct: amount(formData, "margin_pct"),
  };
  if (Object.values(values).some((v) => Number.isNaN(v))) fail(path, "Please enter numbers only");
  if (values.margin_pct !== null && values.margin_pct > 100) fail(path, "Margin must be 100% or less");
  for (const [metric, value] of Object.entries(values)) {
    const error = await upsertTarget(null, metric, value);
    if (error) fail(path, error.message);
  }
  revalidatePath("/", "layout");
  redirect(`${path}?saved=1`);
}

export async function saveMonthTarget(formData: FormData) {
  await requireAdmin();
  const path = "/admin/targets";
  const month = text(formData, "month");
  const value = amount(formData, "amount");
  if (!/^\d{4}-\d{2}$/.test(month)) fail(path, "Please pick a month");
  if (value === null || Number.isNaN(value)) fail(path, "Please enter the goal for that month");
  const error = await upsertTarget(null, "invoiced", value, `${month}-01`);
  if (error) fail(path, error.message);
  revalidatePath("/", "layout");
  redirect(`${path}?saved=1`);
}

export async function deleteTarget(targetId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("monthly_targets").delete().eq("id", targetId);
  if (error) fail("/admin/targets", error.message);
  revalidatePath("/", "layout");
  redirect("/admin/targets?deleted=1");
}

// Every person's monthly sales target in one go (empty = no target).
export async function savePersonTargets(formData: FormData) {
  await requireAdmin();
  const path = "/admin/targets";
  for (const [key] of formData.entries()) {
    if (!key.startsWith("target_")) continue;
    const userId = key.slice("target_".length);
    if (!/^[0-9a-f-]{36}$/i.test(userId)) continue;
    const value = amount(formData, key);
    if (Number.isNaN(value)) fail(path, "Please enter numbers only");
    const error = await upsertTarget(userId, "invoiced", value);
    if (error) fail(path, error.message);
  }
  revalidatePath("/", "layout");
  redirect(`${path}?saved=1`);
}

// The default commission rule (userId null) or one person's own rule.
export async function saveCommissionRule(userId: string | null, formData: FormData) {
  await requireAdmin();
  const path = "/admin/targets";
  const targetUser = userId ?? (text(formData, "user_id") || null);
  const rate = amount(formData, "rate");
  const basis = text(formData, "basis") === "invoiced" ? "invoiced" : "gross_profit";
  const countedWhen = text(formData, "counted_when") === "invoiced" ? "invoiced" : "paid";
  if (rate === null || Number.isNaN(rate) || rate > 100) fail(path, "Please enter a commission rate between 0 and 100%");

  const supabase = await createClient();
  let existing = supabase.from("commission_rules").select("id");
  existing = targetUser ? existing.eq("user_id", targetUser) : existing.is("user_id", null);
  const { data: row } = await existing.maybeSingle();
  const fields = { basis, rate, counted_when: countedWhen, is_example: false };
  const { error } = row
    ? await supabase.from("commission_rules").update(fields).eq("id", row.id)
    : await supabase.from("commission_rules").insert({ ...fields, user_id: targetUser });
  if (error) fail(path, error.message);
  revalidatePath("/", "layout");
  redirect(`${path}?saved=1`);
}

export async function deleteCommissionRule(ruleId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("commission_rules").delete().eq("id", ruleId).not("user_id", "is", null);
  if (error) fail("/admin/targets", error.message);
  revalidatePath("/", "layout");
  redirect("/admin/targets?deleted=1");
}

// ─── Activating staff (with an invite) ──────────────────────────────────────

// Switch someone on (with their role) and email them an invite link to sign
// in. If email isn't set up, the link is shown on their page to send by hand.
// Also used for "Resend invite".
export async function activateStaff(directoryId: string, back: string) {
  const me = await requireAdmin();
  const safeBack = back.startsWith("/admin/") ? back : "/admin/users";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("activate_staff", { p_directory_id: directoryId });
  if (error) fail(safeBack, error.message);
  const invite = data as { token: string; email: string; name: string | null };

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const link = `${origin}/invite/${invite.token}`;
  let status = "nomail";
  if (isEmailConfigured()) {
    const first = (invite.name ?? "").split(" ")[0];
    const { data: settings } = await supabase.from("company_settings").select("company_name").single();
    const company = settings?.company_name ?? "Footprint Group";
    const message = `${first ? `Hi ${first},` : "Hello,"}\n\n${me.fullName ?? "An admin"} has set you up on the ${company} platform, where we run quotes, invoices, customers and more.\n\nUse the button below and sign in with your usual Microsoft work account.`;
    const result = await sendEmail({
      to: invite.email,
      subject: `You're invited to the ${company} platform`,
      text: `${message}\n\nSign in: ${link}`,
      html: brandedHtml({ text: message, buttonLabel: "Sign in to the platform", buttonUrl: link, companyName: company }),
      tag: "staff-invite",
    });
    status = result.ok ? (isEmailTestMode() ? "test" : "sent") : "failed";
  }
  revalidatePath("/admin", "layout");
  redirect(`${safeBack}?invited=${status}`);
}

export async function deactivateStaff(directoryId: string, back: string) {
  await requireAdmin();
  const safeBack = back.startsWith("/admin/") ? back : "/admin/users";
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_staff", { p_directory_id: directoryId });
  if (error) fail(safeBack, error.message);
  revalidatePath("/admin", "layout");
  redirect(`${safeBack}?saved=1`);
}

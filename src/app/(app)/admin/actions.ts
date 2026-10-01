"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
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
async function syncLinks(
  table: "user_roles" | "team_members",
  fixedColumn: "user_id" | "team_id",
  fixedId: string,
  otherColumn: "role_id" | "user_id" | "team_id",
  wanted: string[],
) {
  const supabase = await createClient();
  const { data: current, error } = await supabase
    .from(table)
    .select(otherColumn)
    .eq(fixedColumn, fixedId);
  if (error) throw error;

  const have = new Set((current ?? []).map((r) => (r as Record<string, string>)[otherColumn]));
  const want = new Set(wanted);
  const toAdd = [...want].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));

  if (toAdd.length) {
    const { error: addError } = await supabase
      .from(table)
      .insert(toAdd.map((id) => ({ [fixedColumn]: fixedId, [otherColumn]: id })));
    if (addError) throw addError;
  }
  if (toRemove.length) {
    const { error: removeError } = await supabase
      .from(table)
      .delete()
      .eq(fixedColumn, fixedId)
      .in(otherColumn, toRemove);
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

export async function createRole(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  if (!name) fail("/admin/roles", "Please give the role a name");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .insert({ name, description: text(formData, "description") || null })
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
    .update({ name, description: text(formData, "description") || null })
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

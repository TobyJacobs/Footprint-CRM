"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requirePermission } from "@/lib/auth";
import { bool, int, num, str } from "@/lib/forms";
import { isDateIso, projectStatuses, taskStatuses } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: string | null) => (v && UUID_RE.test(v) ? v : null);
const date = (v: string | null) => (v && isDateIso(v) ? v : null);

// An estimate typed in as hours becomes whole minutes; blank means "no estimate".
function estimate(fd: FormData, name: string, back: string): number | null {
  const hours = num(fd, name);
  if (hours === null) return null;
  if (hours < 0 || hours > 24 * 30) fail(back, "An estimate must be between 0 and 720 hours");
  return Math.round(hours * 60);
}

// Only ever send people back to a page inside Projects & Time.
const safeBack = (v: string | null, fallback: string) => (v && v.startsWith("/projects") && !v.startsWith("//") ? v : fallback);
const withFlag = (path: string, flag: string) => `${path}${path.includes("?") ? "&" : "?"}${flag}=1`;

// ─── Projects ───────────────────────────────────────────────────────────────

export async function saveProject(projectId: string | null, fd: FormData) {
  const user = await requirePermission("projects", "edit");
  const back = projectId ? `/projects/${projectId}/edit` : "/projects/new";
  const name = str(fd, "name");
  const status = str(fd, "status") ?? "active";
  if (!name) fail(back, "Please give the project a name");
  if (!projectStatuses.some((s) => s.value === status)) fail(back, "Unknown status");

  const supabase = await createClient();

  // Optional link to a sales order, by its number (e.g. SO-010913).
  let salesDocumentId: string | null = null;
  const orderNumber = str(fd, "sales_order");
  if (orderNumber) {
    const { data: order } = await supabase.from("sales_documents").select("id").eq("number", orderNumber.toUpperCase()).maybeSingle();
    if (!order) fail(back, `Couldn't find a document numbered ${orderNumber}`);
    salesDocumentId = order.id as string;
  }

  const fields = {
    name,
    customer_id: uuid(str(fd, "customer_id")),
    sales_document_id: salesDocumentId,
    owner_id: uuid(str(fd, "owner_id")) ?? user.id,
    status,
    project_group: str(fd, "project_group"),
    start_date: date(str(fd, "start_date")) ?? undefined,
    due_date: date(str(fd, "due_date")),
    overview: str(fd, "overview"),
  };

  let id = projectId;
  if (projectId) {
    const { error } = await supabase.from("projects").update(fields).eq("id", projectId);
    if (error) fail(back, error.code === "23505" ? "That sales order already has a project" : error.message);
  } else {
    const { data: number, error: numError } = await supabase.rpc("next_document_number", { p_doc_type: "project" });
    if (numError || !number) fail(back, numError?.message ?? "Couldn't get a project number");
    const templateId = uuid(str(fd, "template_id"));
    const { data, error } = await supabase
      .from("projects")
      .insert({ ...fields, number, template_id: templateId })
      .select("id")
      .single();
    if (error) fail(back, error.code === "23505" ? "That sales order already has a project" : error.message);
    id = data.id as string;
    // Start the project with the template's standard stages and steps.
    if (templateId) {
      const { data: steps } = await supabase.from("project_template_tasks").select("stage, position, title, due_offset_days, estimated_minutes").eq("template_id", templateId);
      const start = fields.start_date ?? new Date().toISOString().slice(0, 10);
      if (steps?.length) {
        await supabase.from("project_tasks").insert(
          steps.map((s) => ({
            project_id: id,
            stage: s.stage,
            position: s.position,
            title: s.title,
            estimated_minutes: s.estimated_minutes,
            due_date: s.due_offset_days === null ? null : new Date(new Date(`${start}T12:00:00`).getTime() + s.due_offset_days * 86400000).toISOString().slice(0, 10),
          })),
        );
      }
    }
  }
  revalidatePath("/projects", "layout");
  redirect(`/projects/${id}?saved=1`);
}

export async function deleteProject(projectId: string) {
  await requirePermission("projects", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) fail(`/projects/${projectId}`, error.message);
  revalidatePath("/projects", "layout");
  redirect("/projects?deleted=1");
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function addTask(projectId: string, fd: FormData) {
  await requirePermission("projects", "edit");
  const back = `/projects/${projectId}`;
  const title = str(fd, "title");
  if (!title) fail(back, "Please give the task a title");
  const supabase = await createClient();
  const { data: last } = await supabase.from("project_tasks").select("position").eq("project_id", projectId).order("position", { ascending: false }).limit(1);
  const { error } = await supabase.from("project_tasks").insert({
    project_id: projectId,
    stage: str(fd, "stage") ?? "General",
    title,
    assignee_id: uuid(str(fd, "assignee_id")),
    due_date: date(str(fd, "due_date")),
    estimated_minutes: estimate(fd, "estimate_hours", back),
    position: (last?.[0]?.position ?? 0) + 1,
  });
  if (error) fail(back, error.message);
  revalidatePath("/projects", "layout");
  redirect(`${withFlag(back, "saved")}#tasks`);
}

export async function updateTask(projectId: string, taskId: string, fd: FormData) {
  await requirePermission("projects", "edit");
  const back = `/projects/${projectId}`;
  const status = str(fd, "status");
  const patch: Record<string, unknown> = {};
  if (status) {
    if (!taskStatuses.some((s) => s.value === status)) fail(back, "Unknown status");
    patch.status = status;
  }
  if (fd.has("assignee_id")) patch.assignee_id = uuid(str(fd, "assignee_id"));
  if (fd.has("estimate_hours")) patch.estimated_minutes = estimate(fd, "estimate_hours", back);
  const supabase = await createClient();
  const { error } = await supabase.from("project_tasks").update(patch).eq("id", taskId).eq("project_id", projectId);
  if (error) fail(back, error.message);
  revalidatePath("/projects", "layout");
  redirect(`${back}#tasks`);
}

export async function deleteTask(projectId: string, taskId: string) {
  await requirePermission("projects", "edit");
  const back = `/projects/${projectId}`;
  const supabase = await createClient();
  const { error } = await supabase.from("project_tasks").delete().eq("id", taskId).eq("project_id", projectId);
  if (error) fail(back, error.message);
  revalidatePath(back);
  redirect(`${back}#tasks`);
}

// ─── Time ───────────────────────────────────────────────────────────────────

// Type in time: hours (e.g. 1.5) and/or minutes, on a day.
export async function logTime(fd: FormData) {
  const user = await requirePermission("projects", "view");
  const back = safeBack(str(fd, "back"), "/projects/time");
  const projectId = uuid(str(fd, "project_id"));
  const logDate = date(str(fd, "log_date"));
  const hours = num(fd, "hours");
  if (!projectId) fail(back, "Please choose a project");
  if (!logDate) fail(back, "Please choose the day you worked");
  if (hours === null || hours <= 0 || hours > 24) fail(back, "Hours must be more than 0 and no more than 24");

  const supabase = await createClient();
  const taskId = uuid(str(fd, "task_id"));
  if (taskId) {
    const { data: task } = await supabase.from("project_tasks").select("id").eq("id", taskId).eq("project_id", projectId).maybeSingle();
    if (!task) fail(back, "That task isn't part of the project");
  }
  const { error } = await supabase.from("time_logs").insert({
    project_id: projectId,
    task_id: taskId,
    user_id: user.id,
    log_date: logDate,
    minutes: Math.max(1, Math.round(hours * 60)),
    billable: fd.get("billable") !== "no",
    notes: str(fd, "notes"),
  });
  if (error) fail(back, error.message);
  revalidatePath("/projects", "layout");
  redirect(withFlag(back, "saved"));
}

// Start a running timer on a project (one timer per person at a time).
export async function startTimer(projectId: string, fd: FormData) {
  const user = await requirePermission("projects", "view");
  const back = safeBack(str(fd, "back"), `/projects/${projectId}`);
  const supabase = await createClient();
  const taskId = uuid(str(fd, "task_id"));
  const { error } = await supabase.from("time_logs").insert({
    project_id: projectId,
    task_id: taskId,
    user_id: user.id,
    started_at: new Date().toISOString(),
    minutes: null,
    billable: fd.get("billable") !== "no",
  });
  if (error) fail(back, error.code === "23505" ? "You already have a timer running. Stop it first." : error.message);
  revalidatePath("/projects", "layout");
  redirect(back);
}

export async function stopTimer(logId: string, fd: FormData) {
  const user = await requirePermission("projects", "view");
  const back = safeBack(str(fd, "back"), "/projects/time");
  const supabase = await createClient();
  const { data: running } = await supabase.from("time_logs").select("id, started_at").eq("id", logId).eq("user_id", user.id).is("minutes", null).maybeSingle();
  if (!running?.started_at) fail(back, "That timer isn't running any more");
  const elapsed = Math.round((Date.now() - new Date(running.started_at).getTime()) / 60000);
  const { error } = await supabase
    .from("time_logs")
    .update({ minutes: Math.min(24 * 60, Math.max(1, elapsed)), started_at: null, log_date: new Date().toISOString().slice(0, 10), notes: str(fd, "notes") })
    .eq("id", logId);
  if (error) fail(back, error.message);
  revalidatePath("/projects", "layout");
  redirect(withFlag(back, "saved"));
}

export async function deleteTimeLog(logId: string, fd: FormData) {
  await requirePermission("projects", "view");
  const back = safeBack(str(fd, "back"), "/projects/time");
  const supabase = await createClient();
  const { error } = await supabase.from("time_logs").delete().eq("id", logId);
  if (error) fail(back, error.message);
  revalidatePath("/projects", "layout");
  redirect(withFlag(back, "deleted"));
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function saveTemplate(templateId: string, fd: FormData) {
  await requirePermission("projects", "edit");
  const back = "/projects/templates";
  const name = str(fd, "name");
  if (!name) fail(back, "Please give the template a name");
  const supabase = await createClient();
  const makeDefault = bool(fd, "is_default");
  if (makeDefault) await supabase.from("project_templates").update({ is_default: false }).neq("id", templateId);
  const { error } = await supabase
    .from("project_templates")
    .update({
      name,
      description: str(fd, "description"),
      project_group: str(fd, "project_group"),
      business_unit: str(fd, "business_unit"),
      is_default: makeDefault,
      active: bool(fd, "active"),
    })
    .eq("id", templateId);
  if (error) fail(back, error.code === "23505" ? "A template with that name already exists" : error.message);
  revalidatePath(back);
  redirect(withFlag(back, "saved"));
}

export async function addTemplateTask(templateId: string, fd: FormData) {
  await requirePermission("projects", "edit");
  const back = "/projects/templates";
  const title = str(fd, "title");
  if (!title) fail(back, "Please give the step a title");
  const supabase = await createClient();
  const { data: last } = await supabase.from("project_template_tasks").select("position").eq("template_id", templateId).order("position", { ascending: false }).limit(1);
  const { error } = await supabase.from("project_template_tasks").insert({
    template_id: templateId,
    stage: str(fd, "stage") ?? "General",
    title,
    due_offset_days: int(fd, "due_offset_days"),
    estimated_minutes: estimate(fd, "estimate_hours", back),
    position: (last?.[0]?.position ?? 0) + 1,
  });
  if (error) fail(back, error.message);
  revalidatePath(back);
  redirect(withFlag(back, "saved"));
}

export async function setTemplateTaskEstimate(taskId: string, fd: FormData) {
  await requirePermission("projects", "edit");
  const back = "/projects/templates";
  const supabase = await createClient();
  const { error } = await supabase.from("project_template_tasks").update({ estimated_minutes: estimate(fd, "estimate_hours", back) }).eq("id", taskId);
  if (error) fail(back, error.message);
  revalidatePath(back);
  redirect(withFlag(back, "saved"));
}

export async function deleteTemplateTask(taskId: string) {
  await requirePermission("projects", "edit");
  const back = "/projects/templates";
  const supabase = await createClient();
  const { error } = await supabase.from("project_template_tasks").delete().eq("id", taskId);
  if (error) fail(back, error.message);
  revalidatePath(back);
  redirect(withFlag(back, "deleted"));
}

// ─── Staff cost rates (admins only) ─────────────────────────────────────────

export async function saveCostRates(fd: FormData) {
  await requireAdmin();
  const back = "/projects/rates";
  const supabase = await createClient();
  const defaultRate = num(fd, "default_hourly_cost");
  if (defaultRate !== null) {
    if (defaultRate < 0) fail(back, "Rates can't be negative");
    const { data: settings } = await supabase.from("company_settings").select("id").single();
    if (settings) await supabase.from("company_settings").update({ default_hourly_cost: defaultRate, default_hourly_cost_is_example: false }).eq("id", settings.id);
  }
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith("rate_") || typeof value !== "string") continue;
    const userId = uuid(key.slice(5));
    if (!userId) continue;
    const trimmed = value.trim();
    if (trimmed === "") {
      await supabase.from("staff_cost_rates").delete().eq("user_id", userId);
      continue;
    }
    const rate = Number(trimmed);
    if (!Number.isFinite(rate) || rate < 0) fail(back, "Rates must be numbers, zero or more");
    const { error } = await supabase.from("staff_cost_rates").upsert({ user_id: userId, hourly_cost: rate, is_example: false });
    if (error) fail(back, error.message);
  }
  revalidatePath("/projects", "layout");
  redirect(withFlag(back, "saved"));
}

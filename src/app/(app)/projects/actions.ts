"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { num, str } from "@/lib/forms";
import { isDateIso, projectStatuses, taskStatuses } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: string | null) => (v && UUID_RE.test(v) ? v : null);
const date = (v: string | null) => (v && isDateIso(v) ? v : null);

// Only ever send people back to a page inside Projects & Time.
const safeBack = (v: string | null, fallback: string) => (v && v.startsWith("/projects") && !v.startsWith("//") ? v : fallback);

export async function saveProject(projectId: string | null, fd: FormData) {
  const user = await requirePermission("projects", "edit");
  const back = projectId ? `/projects/${projectId}/edit` : "/projects/new";
  const name = str(fd, "name");
  const status = str(fd, "status") ?? "active";
  if (!name) fail(back, "Please give the project a name");
  if (!projectStatuses.some((s) => s.value === status)) fail(back, "Unknown status");
  const budget = num(fd, "budget_hours");
  if (budget !== null && budget < 0) fail(back, "Budget hours can't be negative");

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
    start_date: date(str(fd, "start_date")),
    due_date: date(str(fd, "due_date")),
    budget_hours: budget,
    description: str(fd, "description"),
  };

  let id = projectId;
  if (projectId) {
    const { error } = await supabase.from("projects").update(fields).eq("id", projectId);
    if (error) fail(back, error.message);
  } else {
    const { data, error } = await supabase.from("projects").insert(fields).select("id").single();
    if (error) fail(back, error.message);
    id = data.id as string;
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

export async function addTask(projectId: string, fd: FormData) {
  await requirePermission("projects", "edit");
  const back = `/projects/${projectId}`;
  const title = str(fd, "title");
  if (!title) fail(back, "Please give the task a title");
  const supabase = await createClient();
  const { count } = await supabase.from("project_tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  const { error } = await supabase.from("project_tasks").insert({
    project_id: projectId,
    title,
    assignee_id: uuid(str(fd, "assignee_id")),
    due_date: date(str(fd, "due_date")),
    estimate_hours: num(fd, "estimate_hours"),
    position: count ?? 0,
  });
  if (error) fail(back, error.message);
  revalidatePath(back);
  redirect(`${back}?saved=1#tasks`);
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
  if (fd.has("due_date")) patch.due_date = date(str(fd, "due_date"));
  const supabase = await createClient();
  const { error } = await supabase.from("project_tasks").update(patch).eq("id", taskId).eq("project_id", projectId);
  if (error) fail(back, error.message);
  revalidatePath(back);
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

// Log hours against a project (and optionally one of its tasks).
export async function logTime(fd: FormData) {
  const user = await requirePermission("projects", "edit");
  const back = safeBack(str(fd, "back"), "/projects/time");
  const projectId = uuid(str(fd, "project_id"));
  const workDate = date(str(fd, "work_date"));
  const hours = num(fd, "hours");
  if (!projectId) fail(back, "Please choose a project");
  if (!workDate) fail(back, "Please choose the day you worked");
  if (hours === null || hours <= 0 || hours > 24) fail(back, "Hours must be more than 0 and no more than 24");

  const supabase = await createClient();
  const taskId = uuid(str(fd, "task_id"));
  if (taskId) {
    const { data: task } = await supabase.from("project_tasks").select("id").eq("id", taskId).eq("project_id", projectId).maybeSingle();
    if (!task) fail(back, "That task isn't part of the project");
  }
  const { error } = await supabase.from("time_entries").insert({
    project_id: projectId,
    task_id: taskId,
    user_id: user.id,
    work_date: workDate,
    hours,
    notes: str(fd, "notes"),
  });
  if (error) fail(back, error.message);
  revalidatePath("/projects", "layout");
  redirect(`${back}${back.includes("?") ? "&" : "?"}saved=1`);
}

export async function deleteTimeEntry(entryId: string, fd: FormData) {
  await requirePermission("projects", "edit");
  const back = safeBack(str(fd, "back"), "/projects/time");
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").delete().eq("id", entryId);
  if (error) fail(back, error.message);
  revalidatePath("/projects", "layout");
  redirect(`${back}${back.includes("?") ? "&" : "?"}deleted=1`);
}

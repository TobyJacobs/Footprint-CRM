"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requirePermission } from "@/lib/auth";
import { aiKinds, criteria, isAiDecision, isAiStage, isCriterion, isScoreStatus } from "@/lib/ai/options";
import { ukToday } from "@/lib/dates";
import { int, num, str } from "@/lib/forms";
import { isDateIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";

// Every action checks FootprintAI access (the invite list) and runs as the
// signed-in person, so the database's own rules apply as well.

function fail(path: string, message: string): never {
  // The message goes before any "#section", or the page never sees it.
  const [base, section] = path.split("#");
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}${section ? `#${section}` : ""}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: string | null) => (v && UUID_RE.test(v) ? v : null);
const date = (v: string | null) => (v && isDateIso(v) ? v : null);
const text = (fd: FormData, name: string, max = 2000) => str(fd, name)?.slice(0, max) ?? null;

// ─── Projects ───────────────────────────────────────────────────────────────

export async function saveProject(projectId: string | null, fd: FormData) {
  await requirePermission("ai", "edit");
  const back = projectId ? `/ai/${projectId}` : "/ai/new";
  const title = text(fd, "title", 200);
  if (!title) fail(back, "Please give it a name");
  const kind = str(fd, "kind") ?? "agent";
  if (!aiKinds.some((k) => k.value === kind)) fail(back, "Unknown type");
  const stage = str(fd, "stage") ?? "planned";
  if (!isAiStage(stage)) fail(back, "Unknown stage");
  const decision = str(fd, "decision");
  if (decision && !isAiDecision(decision)) fail(back, "Unknown decision");

  const fields = {
    title,
    kind,
    stage,
    decision: decision || null,
    summary: text(fd, "summary", 5000),
    owner_id: uuid(str(fd, "owner_id")),
    wave: text(fd, "wave", 50),
    pilot_job: text(fd, "pilot_job"),
    tools: text(fd, "tools", 500),
    human_check: text(fd, "human_check", 500),
    next_step: text(fd, "next_step"),
    start_date: date(str(fd, "start_date")),
    decision_date: date(str(fd, "decision_date")),
  };

  const supabase = await createClient();
  if (!projectId) {
    const { data, error } = await supabase.from("ai_projects").insert(fields).select("id").single();
    if (error) fail(back, error.message);
    revalidatePath("/ai", "layout");
    redirect(`/ai/${data.id}?saved=1`);
  }
  const { error } = await supabase.from("ai_projects").update(fields).eq("id", projectId);
  if (error) fail(back, error.message);
  revalidatePath("/ai", "layout");
  redirect(`${back}?saved=1`);
}

// Move a project to another stage (the buttons on the progress bar).
export async function setStage(projectId: string, fd: FormData) {
  await requirePermission("ai", "edit");
  const back = `/ai/${projectId}`;
  const stage = str(fd, "stage");
  if (!isAiStage(stage)) fail(back, "Unknown stage");
  const supabase = await createClient();
  const { error } = await supabase.from("ai_projects").update({ stage }).eq("id", projectId);
  if (error) fail(back, error.message);
  revalidatePath("/ai", "layout");
  redirect(back);
}

export async function deleteProject(projectId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("ai_projects").delete().eq("id", projectId);
  if (error) fail(`/ai/${projectId}`, error.message);
  revalidatePath("/ai", "layout");
  redirect("/ai?deleted=1");
}

// ─── Scorecard ──────────────────────────────────────────────────────────────

// Saves all seven rows at once.
export async function saveScorecard(projectId: string, fd: FormData) {
  await requirePermission("ai", "edit");
  const back = `/ai/${projectId}`;
  const supabase = await createClient();
  for (const c of criteria) {
    const status = str(fd, `status_${c.value}`) ?? "not_started";
    if (!isScoreStatus(status) || !isCriterion(c.value)) fail(`${back}#scorecard`, "Unknown scorecard value");
    // The seven rows are made with the project, so this only ever updates.
    const { data, error } = await supabase
      .from("ai_scores")
      .update({ status, evidence: text(fd, `evidence_${c.value}`) })
      .eq("project_id", projectId)
      .eq("criterion", c.value)
      .select("criterion");
    if (error) fail(`${back}#scorecard`, error.message);
    if (!data?.length) fail(`${back}#scorecard`, "The scorecard couldn't be saved");
  }
  revalidatePath("/ai", "layout");
  redirect(`${back}?saved=1#scorecard`);
}

// ─── Test log ───────────────────────────────────────────────────────────────

export async function logTestRun(projectId: string, fd: FormData) {
  const user = await requirePermission("ai", "edit");
  const back = `/ai/${projectId}`;
  const task = text(fd, "task", 500);
  if (!task) fail(`${back}#tests`, "Please say what the task was");
  const minutes = (name: string) => {
    const n = int(fd, name);
    return n === null ? null : Math.max(0, Math.min(100000, n));
  };
  const usable = str(fd, "usable");
  const cost = num(fd, "cost");
  const supabase = await createClient();
  const { data: project } = await supabase.from("ai_projects").select("stage").eq("id", projectId).maybeSingle();
  if (!project) fail(back, "Project not found");
  const { error } = await supabase.from("ai_test_runs").insert({
    project_id: projectId,
    run_date: date(str(fd, "run_date")) ?? ukToday(),
    task,
    stage: project.stage,
    manual_minutes: minutes("manual_minutes"),
    agent_minutes: minutes("agent_minutes"),
    usable: usable === "yes" ? true : usable === "no" ? false : null,
    errors: Math.max(0, int(fd, "errors") ?? 0),
    serious_error: str(fd, "serious_error") === "on",
    cost: cost === null ? null : Math.max(0, Math.round(cost * 100) / 100),
    notes: text(fd, "notes"),
    logged_by: user.id,
  });
  if (error) fail(`${back}#tests`, error.message);
  revalidatePath("/ai", "layout");
  redirect(`${back}?saved=1#tests`);
}

export async function deleteTestRun(projectId: string, runId: string) {
  await requirePermission("ai", "edit");
  const back = `/ai/${projectId}`;
  const supabase = await createClient();
  // The database only lets people delete their own tests (admins any).
  const { data, error } = await supabase.from("ai_test_runs").delete().eq("id", runId).eq("project_id", projectId).select("id");
  if (error) fail(`${back}#tests`, error.message);
  if (!data?.length) fail(`${back}#tests`, "You can only delete tests you logged");
  revalidatePath("/ai", "layout");
  redirect(`${back}#tests`);
}

// ─── Updates ────────────────────────────────────────────────────────────────

export async function addUpdate(projectId: string, fd: FormData) {
  const user = await requirePermission("ai", "edit");
  const back = `/ai/${projectId}`;
  const body = text(fd, "body", 5000);
  if (!body) fail(`${back}#updates`, "Please write an update");
  const supabase = await createClient();
  const { error } = await supabase.from("ai_project_updates").insert({ project_id: projectId, body, author_id: user.id });
  if (error) fail(`${back}#updates`, error.message);
  revalidatePath(back);
  redirect(`${back}#updates`);
}

export async function deleteUpdate(projectId: string, updateId: string) {
  await requirePermission("ai", "edit");
  const back = `/ai/${projectId}`;
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_project_updates").delete().eq("id", updateId).eq("project_id", projectId).select("id");
  if (error) fail(`${back}#updates`, error.message);
  if (!data?.length) fail(`${back}#updates`, "You can only delete your own updates");
  revalidatePath(back);
  redirect(`${back}#updates`);
}

// ─── Invite list (admins only) ──────────────────────────────────────────────

export async function addMember(fd: FormData) {
  const admin = await requireAdmin();
  const userId = uuid(str(fd, "user_id"));
  if (!userId) fail("/ai/members", "Please choose someone");
  const supabase = await createClient();
  const { error } = await supabase.from("ai_members").insert({ user_id: userId, added_by: admin.id });
  if (error) fail("/ai/members", error.code === "23505" ? "They're already on the list" : error.message);
  revalidatePath("/ai", "layout");
  redirect("/ai/members?saved=1");
}

export async function removeMember(userId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("ai_members").delete().eq("user_id", userId);
  if (error) fail("/ai/members", error.message);
  revalidatePath("/ai", "layout");
  redirect("/ai/members?deleted=1");
}

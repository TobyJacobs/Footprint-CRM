"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requirePermission } from "@/lib/auth";
import { str } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Roadmap and requests. Seeing the roadmap and sending requests needs the
// "roadmap" permission (admins always have it); everything else is admin-only.
// The database enforces the same rules.

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

const REVIEW = "/roadmap/review";
const done = (path = "/roadmap") => {
  revalidatePath("/roadmap", "layout");
  redirect(`${path}${path.includes("?") ? "&" : "?"}saved=1`);
};

// ─── Roadmap (admins) ───────────────────────────────────────────────────────

export async function toggleRoadmapTask(taskId: string, isDone: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("roadmap_tasks").update({ done: isDone }).eq("id", taskId);
  if (error) fail("/roadmap", error.message);
  revalidatePath("/roadmap", "layout");
  redirect(`/roadmap#task-${taskId}`);
}

// Remove a task from the roadmap (admins only). If it came from an approved
// request, the request stays on record as approved.
export async function deleteRoadmapTask(taskId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("roadmap_tasks").delete().eq("id", taskId);
  if (error) fail("/roadmap", error.message);
  done();
}

export async function addRoadmapTask(waveId: string, fd: FormData) {
  await requireAdmin();
  const title = str(fd, "title");
  if (!title) fail("/roadmap", "Please give the task a name");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("roadmap_tasks")
    .select("position")
    .eq("wave_id", waveId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("roadmap_tasks")
    .insert({ wave_id: waveId, title, position: (last?.position ?? 0) + 1 });
  if (error) fail("/roadmap", error.message);
  done();
}

export async function setWaveOnHold(waveId: string, onHold: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("roadmap_waves").update({ on_hold: onHold }).eq("id", waveId);
  if (error) fail("/roadmap", error.message);
  done();
}

// ─── Requests ───────────────────────────────────────────────────────────────

export async function submitRequest(fd: FormData) {
  await requirePermission("roadmap", "view");
  const kind = str(fd, "kind") === "bug" ? "bug" : "suggestion";
  const title = str(fd, "title");
  if (!title) fail("/roadmap", "Please give your request a short title");
  const supabase = await createClient();
  const { error } = await supabase.from("feedback_requests").insert({
    kind,
    title: title.slice(0, 200),
    details: str(fd, "details")?.slice(0, 5000) ?? null,
    wave_id: str(fd, "wave_id"),
    page: str(fd, "page"),
  });
  if (error) fail("/roadmap", error.message);
  revalidatePath("/roadmap", "layout");
  redirect("/roadmap?sent=1");
}

// Approve: becomes a task on the chosen wave (so it gets built).
export async function approveRequest(requestId: string, fd: FormData) {
  await requireAdmin();
  const waveId = str(fd, "wave_id");
  const title = str(fd, "task_title");
  if (!waveId) fail(REVIEW, "Choose which wave it goes on");
  if (!title) fail(REVIEW, "Give the roadmap task a name");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("roadmap_tasks")
    .select("position")
    .eq("wave_id", waveId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: task, error } = await supabase
    .from("roadmap_tasks")
    .insert({ wave_id: waveId, title, request_id: requestId, position: (last?.position ?? 0) + 1 })
    .select("id")
    .single();
  if (error) fail(REVIEW, error.message);
  const { error: updError } = await supabase
    .from("feedback_requests")
    .update({
      status: "approved",
      wave_id: waveId,
      task_id: task.id,
      admin_note: str(fd, "note"),
      decided_at: new Date().toISOString(),
      decided_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .eq("id", requestId);
  if (updError) fail(REVIEW, updError.message);
  done(REVIEW);
}

export async function denyRequest(requestId: string, fd: FormData) {
  await requireAdmin();
  const note = str(fd, "note");
  if (!note) fail(REVIEW, "Please give a short reason, so they know why");
  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback_requests")
    .update({
      status: "denied",
      admin_note: note,
      decided_at: new Date().toISOString(),
      decided_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .eq("id", requestId);
  if (error) fail(REVIEW, error.message);
  done(REVIEW);
}

// Query: ask the sender a question. Their reply sends it back for review.
export async function queryRequest(requestId: string, fd: FormData) {
  await requireAdmin();
  const question = str(fd, "question");
  if (!question) fail(REVIEW, "Please write your question");
  const supabase = await createClient();
  const { error } = await supabase.from("feedback_comments").insert({ request_id: requestId, body: question });
  if (error) fail(REVIEW, error.message);
  await supabase.from("feedback_requests").update({ status: "query" }).eq("id", requestId);
  done(REVIEW);
}

export async function replyToRequest(requestId: string, fd: FormData) {
  await requirePermission("roadmap", "view");
  const body = str(fd, "body");
  if (!body) fail("/roadmap", "Please write your reply");
  const supabase = await createClient();
  const { error } = await supabase.from("feedback_comments").insert({ request_id: requestId, body: body.slice(0, 5000) });
  if (error) fail("/roadmap", error.message);
  done();
}

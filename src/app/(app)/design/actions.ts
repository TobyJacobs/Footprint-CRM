"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { DESIGN_BUCKET, DESIGN_FILE_MAX_BYTES, DESIGN_FILE_TYPES, isDesignStage } from "@/lib/design/options";
import { bool, str } from "@/lib/forms";
import { isDateIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";

// Every action checks the "design" permission and runs as the signed-in
// person, so the database's own rules apply as well.

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: string | null) => (v && UUID_RE.test(v) ? v : null);
const date = (v: string | null) => (v && isDateIso(v) ? v : null);

// Only ever send people back to a page inside FootprintOS's design, sales,
// projects or customers sections.
const safeBack = (v: string | null, fallback: string) =>
  v && /^\/(design|sales|projects|customers)(\/|\?|$)/.test(v) && !v.startsWith("//") ? v : fallback;
const withFlag = (path: string, flag: string) => `${path}${path.includes("?") ? "&" : "?"}${flag}=1`;

export async function saveJob(jobId: string | null, fd: FormData) {
  // Anyone who can see Design can raise a new job; changing one needs edit.
  const user = await requirePermission("design", jobId ? "edit" : "view");
  const back = jobId ? `/design/${jobId}` : "/design/new";
  const title = str(fd, "title");
  if (!title) fail(back, "Please give the job a title");
  const stage = str(fd, "stage") ?? "todo";
  if (!isDesignStage(stage)) fail(back, "Unknown stage");

  const supabase = await createClient();
  const fields: Record<string, unknown> = {
    title,
    brief: str(fd, "brief"),
    customer_id: uuid(str(fd, "customer_id")),
    designer_id: uuid(str(fd, "designer_id")),
    due_date: date(str(fd, "due_date")),
    high_priority: bool(fd, "high_priority"),
  };
  // Only designers (edit) choose the stage; a new request from anyone else starts at "To do".
  if (user.can("design", "edit")) fields.stage = stage;

  if (!jobId) {
    // Links to the order and project are set once, when the job is raised from them.
    const orderId = uuid(str(fd, "sales_order_id"));
    const projectId = uuid(str(fd, "project_id"));
    if (orderId) {
      const { data: order } = await supabase.from("sales_documents").select("id, doc_type").eq("id", orderId).maybeSingle();
      if (!order || order.doc_type !== "sales_order") fail(back, "That sales order couldn't be found");
    }
    if (projectId) {
      const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
      if (!project) fail(back, "That project couldn't be found");
    }
    fields.sales_order_id = orderId;
    fields.project_id = projectId;

    const { data, error } = await supabase.from("design_jobs").insert(fields).select("id").single();
    if (error) fail(back, error.message);
    revalidatePath("/design", "layout");
    redirect(`/design/${data.id}?saved=1`);
  }

  const { error } = await supabase.from("design_jobs").update(fields).eq("id", jobId);
  if (error) fail(back, error.message);
  revalidatePath("/design", "layout");
  redirect(withFlag(safeBack(str(fd, "back"), `/design/${jobId}`), "saved"));
}

// Move a job to another stage (the buttons on the job page and the board).
export async function setJobStage(jobId: string, fd: FormData) {
  await requirePermission("design", "edit");
  const back = safeBack(str(fd, "back"), `/design/${jobId}`);
  const stage = str(fd, "stage");
  if (!isDesignStage(stage)) fail(back, "Unknown stage");
  const supabase = await createClient();
  const { error } = await supabase.from("design_jobs").update({ stage }).eq("id", jobId);
  if (error) fail(back, error.message);
  revalidatePath("/design", "layout");
  redirect(back);
}

export async function deleteJob(jobId: string) {
  await requirePermission("design", "delete");
  const supabase = await createClient();
  // Remove the stored files too, so nothing is left behind.
  const { data: files } = await supabase.from("design_job_files").select("path").eq("job_id", jobId);
  if (files?.length) {
    const { error: storageError } = await supabase.storage.from(DESIGN_BUCKET).remove(files.map((f) => f.path as string));
    if (storageError) fail(`/design/${jobId}`, `The files couldn't be removed: ${storageError.message}`);
  }
  const { error } = await supabase.from("design_jobs").delete().eq("id", jobId);
  if (error) fail(`/design/${jobId}`, error.message);
  revalidatePath("/design", "layout");
  redirect("/design?deleted=1");
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export async function addNote(jobId: string, fd: FormData) {
  const user = await requirePermission("design", "view");
  const back = `/design/${jobId}`;
  const body = str(fd, "body");
  if (!body) fail(back, "Please write a note");
  const supabase = await createClient();
  const { error } = await supabase.from("design_job_notes").insert({ job_id: jobId, body: body.slice(0, 5000), author_id: user.id });
  if (error) fail(back, error.message);
  revalidatePath(`/design/${jobId}`);
  redirect(`${back}#notes`);
}

export async function deleteNote(jobId: string, noteId: string) {
  await requirePermission("design", "view");
  const supabase = await createClient();
  // The database only lets people delete their own notes (or designers any note).
  const { data, error } = await supabase.from("design_job_notes").delete().eq("id", noteId).eq("job_id", jobId).select("id");
  if (error) fail(`/design/${jobId}`, error.message);
  if (!data?.length) fail(`/design/${jobId}`, "You can only delete your own notes");
  revalidatePath(`/design/${jobId}`);
  redirect(`/design/${jobId}#notes`);
}

// ─── Files ──────────────────────────────────────────────────────────────────

// Called by the uploader after a file has gone straight to private storage:
// records it against the job (proofs get the next version number).
export async function recordFile(
  jobId: string,
  file: { path: string; name: string; size: number; type: string; kind: string; note: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requirePermission("design", "view");
  if (!UUID_RE.test(jobId)) return { ok: false, error: "Unknown job" };
  // The file must be in this job's folder and be a type and size we accept.
  if (typeof file.path !== "string" || !file.path.startsWith(`${jobId}/`) || file.path.includes("..")) return { ok: false, error: "That file isn't in this job's folder" };
  if (!DESIGN_FILE_TYPES.includes(file.type)) return { ok: false, error: "Only images and PDFs can be added" };
  if (!(file.size > 0 && file.size <= DESIGN_FILE_MAX_BYTES)) return { ok: false, error: "Files must be 25 MB or smaller" };
  // Proofs come from the design team; anyone else can add brief files.
  const kind = file.kind === "proof" && user.can("design", "edit") ? "proof" : "brief";
  const supabase = await createClient();
  const { error } = await supabase.from("design_job_files").insert({
    job_id: jobId,
    kind,
    path: file.path,
    file_name: String(file.name).slice(0, 200),
    size_bytes: file.size,
    content_type: file.type,
    note: file.note ? String(file.note).slice(0, 500) : null,
    uploaded_by: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/design/${jobId}`);
  return { ok: true };
}

export async function deleteFile(jobId: string, fileId: string) {
  await requirePermission("design", "delete");
  const back = `/design/${jobId}`;
  const supabase = await createClient();
  const { data: file } = await supabase.from("design_job_files").select("id, path").eq("id", fileId).eq("job_id", jobId).maybeSingle();
  if (!file) fail(back, "File not found");
  const { error: storageError } = await supabase.storage.from(DESIGN_BUCKET).remove([file.path as string]);
  if (storageError) fail(back, storageError.message);
  const { error } = await supabase.from("design_job_files").delete().eq("id", fileId);
  if (error) fail(back, error.message);
  revalidatePath(back);
  redirect(`${back}?deleted=1#files`);
}

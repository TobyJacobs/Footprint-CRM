import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DESIGN_BUCKET } from "./options";

export type JobRow = {
  id: string;
  number: number;
  title: string;
  stage: string;
  due_date: string | null;
  high_priority: boolean;
  designer_id: string | null;
  stage_changed_at: string;
  completed_at: string | null;
  customer: { id: string; name: string } | null;
};

const JOB_COLUMNS = "id, number, title, stage, due_date, high_priority, designer_id, stage_changed_at, completed_at, customers(id, name)";

export type JobFilters = {
  designerId?: string | null;
  customerId?: string | null;
  salesOrderId?: string | null;
  projectId?: string | null;
  requestedBy?: string | null;
  highPriorityOnly?: boolean;
  stage?: string | null;
  // Finished jobs: leave out, or only those done in the last N days.
  doneWithinDays?: number | null;
  includeAllDone?: boolean;
};

// Design jobs, high priority first, then by due date (no date last).
export async function loadJobs(supabase: SupabaseClient, f: JobFilters = {}): Promise<JobRow[]> {
  let q = supabase
    .from("design_jobs")
    .select(JOB_COLUMNS)
    .order("high_priority", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("number")
    .limit(1000);
  if (f.designerId) q = q.eq("designer_id", f.designerId);
  if (f.customerId) q = q.eq("customer_id", f.customerId);
  if (f.salesOrderId) q = q.eq("sales_order_id", f.salesOrderId);
  if (f.projectId) q = q.eq("project_id", f.projectId);
  if (f.requestedBy) q = q.eq("requested_by", f.requestedBy);
  if (f.highPriorityOnly) q = q.eq("high_priority", true);
  if (f.stage) q = q.eq("stage", f.stage);
  if (!f.includeAllDone && !f.stage) {
    if (f.doneWithinDays) {
      const since = new Date(Date.now() - f.doneWithinDays * 86400000).toISOString();
      q = q.or(`stage.neq.done,completed_at.gte."${since}"`);
    } else {
      q = q.neq("stage", "done");
    }
  }
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    number: r.number as number,
    title: r.title as string,
    stage: r.stage as string,
    due_date: r.due_date as string | null,
    high_priority: Boolean(r.high_priority),
    designer_id: r.designer_id as string | null,
    stage_changed_at: r.stage_changed_at as string,
    completed_at: r.completed_at as string | null,
    customer: r.customers as unknown as { id: string; name: string } | null,
  }));
}

// Everyone who has signed in, for designer pickers and names.
export async function loadPeople(supabase: SupabaseClient) {
  const { data } = await supabase.from("profiles").select("id, full_name, email, is_active").order("full_name");
  const all = (data ?? []).map((p) => ({
    id: p.id as string,
    name: ((p.full_name as string | null) ?? (p.email as string)) || "Unknown",
    active: p.is_active !== false,
  }));
  return { pickable: all.filter((p) => p.active), nameOf: new Map(all.map((p) => [p.id, p.name])) };
}

export type JobFile = {
  id: string;
  kind: "proof" | "brief";
  version: number | null;
  name: string;
  size: number | null;
  type: string | null;
  note: string | null;
  uploadedBy: string | null;
  createdAt: string;
  url: string | null;
  isImage: boolean;
};

// A job's files with short-lived links to open them (newest proof first).
export async function loadJobFiles(supabase: SupabaseClient, jobId: string): Promise<JobFile[]> {
  const { data } = await supabase
    .from("design_job_files")
    .select("id, kind, version, path, file_name, size_bytes, content_type, note, uploaded_by, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const { data: signed } = rows.length
    ? await supabase.storage.from(DESIGN_BUCKET).createSignedUrls(rows.map((r) => r.path as string), 3600)
    : { data: [] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id as string,
    kind: r.kind === "brief" ? "brief" : "proof",
    version: r.version as number | null,
    name: r.file_name as string,
    size: r.size_bytes === null ? null : Number(r.size_bytes),
    type: r.content_type as string | null,
    note: r.note as string | null,
    uploadedBy: r.uploaded_by as string | null,
    createdAt: r.created_at as string,
    url: urlFor.get(r.path as string) ?? null,
    isImage: String(r.content_type ?? "").startsWith("image/"),
  }));
}

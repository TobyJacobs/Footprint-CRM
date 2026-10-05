import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RequestFile = { id: string; name: string; size: number | null; type: string | null; url: string | null; isImage: boolean };

// The attachments for a set of requests, with short-lived links to open them.
// Runs as the signed-in person, so they only get files they're allowed to see.
export async function loadAttachments(supabase: SupabaseClient, requestIds: string[]): Promise<Map<string, RequestFile[]>> {
  const out = new Map<string, RequestFile[]>();
  if (requestIds.length === 0) return out;
  const { data } = await supabase
    .from("feedback_attachments")
    .select("id, request_id, path, file_name, size_bytes, content_type")
    .in("request_id", requestIds)
    .order("created_at");
  const rows = data ?? [];
  const { data: signed } = rows.length
    ? await supabase.storage.from("request-attachments").createSignedUrls(
        rows.map((r) => r.path as string),
        3600,
      )
    : { data: [] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  for (const r of rows) {
    const list = out.get(r.request_id as string) ?? [];
    list.push({
      id: r.id as string,
      name: r.file_name as string,
      size: r.size_bytes === null ? null : Number(r.size_bytes),
      type: r.content_type as string | null,
      url: urlFor.get(r.path as string) ?? null,
      isImage: String(r.content_type ?? "").startsWith("image/"),
    });
    out.set(r.request_id as string, list);
  }
  return out;
}

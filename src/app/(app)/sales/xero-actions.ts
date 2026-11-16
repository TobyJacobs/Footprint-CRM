"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runXeroSync } from "@/lib/xero/sync";

// "Send to Xero now" on an issued invoice or credit note: queue it (the
// database checks it can be sent) and send it straight away as a draft.
export async function sendToXero(documentId: string) {
  await requirePermission("quotes", "edit");
  const back = (q: string): never => redirect(`/sales/${documentId}?${q}`);
  const supabase = await createClient();
  const { data: jobId, error } = await supabase.rpc("xero_queue_document", { p_document: documentId });
  if (error || typeof jobId !== "string") back(`error=${encodeURIComponent(error?.message ?? "Couldn't send to Xero")}`);
  const r = await runXeroSync({ onlyJob: jobId });
  revalidatePath(`/sales/${documentId}`);
  if (!r.ok) back(`error=${encodeURIComponent(`Not sent to Xero: ${r.error ?? "unknown error"}. It will be tried again automatically.`)}`);
  back("saved=1");
}

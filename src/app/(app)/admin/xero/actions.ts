"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { bool, str } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { runXeroSync } from "@/lib/xero/sync";

// Admin → Xero. The database checks each of these is an admin too.

const back = (q: string): never => redirect(`/admin/xero?${q}`);

export async function saveXeroSettings(fd: FormData) {
  await requireAdmin();
  const taxMap: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("tax_") && typeof v === "string" && /^[A-Z0-9_]{2,40}$/i.test(v.trim())) taxMap[k.slice(4)] = v.trim();
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("xero_save_admin_settings", {
    p_auto_send: bool(fd, "auto_send"),
    p_send_from: str(fd, "send_from"),
    p_use_os_numbers: str(fd, "numbers") !== "xero",
    p_tax_map: taxMap,
  });
  if (error) back(`error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/xero");
  back("saved=1");
}

export async function disconnectXero() {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("xero_disconnect");
  if (error) back(`error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/xero");
  back("saved=1");
}

export async function syncXeroNow() {
  await requireAdmin();
  const r = await runXeroSync();
  revalidatePath("/admin/xero");
  if (!r.ok && r.error) back(`error=${encodeURIComponent(`${r.sent} sent, ${r.failed} not sent: ${r.error}`)}`);
  back(`synced=${r.sent}`);
}

export async function retryXeroJob(jobId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.rpc("xero_retry_job", { p_job: jobId });
  const r = await runXeroSync({ onlyJob: jobId });
  revalidatePath("/admin/xero");
  if (!r.ok && r.error) back(`error=${encodeURIComponent(r.error)}`);
  back(`synced=${r.sent}`);
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listStaff } from "./graph";

export type SyncResult = { ok: true; seen: number; added: number; switched_off: number } | { ok: false; error: string };

// Fetch everyone from Microsoft 365 and hand the list to the database, which
// updates the staff directory, roles and leavers. `key` is only used by the
// daily job; an admin pressing "Sync now" is checked by their own login.
export async function runDirectorySync(supabase: SupabaseClient, key?: string): Promise<SyncResult> {
  let users;
  try {
    users = await listStaff();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't reach Microsoft 365" };
  }
  const { data, error } = await supabase.rpc("directory_sync_apply", { p_users: users, p_key: key ?? null });
  if (error) return { ok: false, error: error.message };
  return data as SyncResult;
}

import "server-only";
import { createClient } from "@/lib/supabase/server";

// Active staff, for "account owner" and "account manager" choices.
export async function getStaffOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_active", true)
    .order("full_name");
  return (data ?? []).map((p) => ({ id: p.id as string, name: (p.full_name ?? p.email) as string }));
}

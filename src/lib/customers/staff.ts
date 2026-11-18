import "server-only";
import { getCurrentUser } from "@/lib/auth";
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

// Choices for "Salesperson" on quotes, orders, invoices, purchase orders and
// recurring invoices. People who can only see their own documents (e.g. the
// Sales team) can only pick themselves — the database insists on it too.
export async function getSalespersonOptions() {
  const user = await getCurrentUser();
  if (!user.seesAllSales) return [{ id: user.id, name: user.fullName ?? user.email }];
  return getStaffOptions();
}

import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { exportResponse } from "@/lib/customers/gdpr";
import { createClient } from "@/lib/supabase/server";

// Everything held about a customer and its people (admins only) — for a
// sole trader's subject access request, or a business asking for its data.
export async function GET(_req: NextRequest, ctx: RouteContext<"/customers/[id]/export">) {
  const user = await requireAdmin();
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!customer) notFound();

  const [{ data: contacts }, { data: hosting }, { data: retainers }, { data: timeline }, { data: history }] = await Promise.all([
    supabase.from("contacts").select("*").eq("customer_id", id),
    supabase.from("hosting_plans").select("*, hosting_items(*)").eq("customer_id", id),
    supabase.from("retainers").select("*, retainer_services(*)").eq("customer_id", id),
    supabase.from("customer_activity").select("*").eq("customer_id", id).order("occurred_at"),
    supabase
      .from("audit_log")
      .select("at, action, table_name, actor_email, old_data, new_data")
      .or(`and(table_name.eq.customers,record->>id.eq.${id}),record->>customer_id.eq.${id}`)
      .order("at"),
  ]);

  await supabase.rpc("log_admin_event", {
    p_action: "gdpr_export",
    p_table: "customers",
    p_record: { id },
  });

  return exportResponse(user, customer.name, `Customer: ${customer.name}`, {
    customer,
    contacts: contacts ?? [],
    hosting_plans: hosting ?? [],
    digital_retainers: retainers ?? [],
    timeline_entries: timeline ?? [],
    change_history: history ?? [],
  });
}

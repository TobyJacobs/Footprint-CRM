import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { personName } from "@/lib/customers/display";
import { exportResponse } from "@/lib/customers/gdpr";
import { createClient } from "@/lib/supabase/server";

// Subject access export for one person (admins only).
export async function GET(_req: NextRequest, ctx: RouteContext<"/customers/[id]/contacts/[contactId]/export">) {
  const user = await requireAdmin();
  const { id, contactId } = await ctx.params;
  const supabase = await createClient();

  const { data: contact } = await supabase.from("contacts").select("*").eq("id", contactId).eq("customer_id", id).maybeSingle();
  if (!contact) notFound();

  const [{ data: customer }, { data: timeline }, { data: history }] = await Promise.all([
    supabase.from("customers").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("customer_activity").select("kind, body, occurred_at, created_at").eq("contact_id", contactId).order("occurred_at"),
    supabase
      .from("audit_log")
      .select("at, action, actor_email, old_data, new_data")
      .eq("table_name", "contacts")
      .eq("record->>id", contactId)
      .order("at"),
  ]);

  await supabase.rpc("log_admin_event", {
    p_action: "gdpr_export",
    p_table: "contacts",
    p_record: { id: contactId },
  });

  return exportResponse(user, personName(contact), `Contact: ${personName(contact)}`, {
    personal_details: contact,
    works_for: customer,
    timeline_entries: timeline ?? [],
    change_history: history ?? [],
  });
}

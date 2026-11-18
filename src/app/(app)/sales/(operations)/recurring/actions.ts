"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requirePermission } from "@/lib/auth";
import { bool, str } from "@/lib/forms";
import { frequencies, recurringStatuses } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";

// Recurring invoices. Every action checks the "quotes" permission and runs
// as the signed-in person, so the database's rules apply too.

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

type LineIn = {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  discount_percent: number;
  tax_rate_id: string | null;
  tax_rate: number;
};

function parseLines(fd: FormData): LineIn[] | null {
  try {
    const raw = JSON.parse(String(fd.get("lines_json") ?? "[]"));
    if (!Array.isArray(raw)) return null;
    return raw.map((l) => ({
      product_id: typeof l.product_id === "string" && l.product_id ? l.product_id : null,
      description: String(l.description ?? "").slice(0, 5000),
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unit_price) || 0,
      unit_cost: l.unit_cost === null || l.unit_cost === "" || l.unit_cost === undefined ? null : Number(l.unit_cost) || 0,
      discount_percent: Math.min(100, Math.max(0, Number(l.discount_percent) || 0)),
      tax_rate_id: typeof l.tax_rate_id === "string" && l.tax_rate_id ? l.tax_rate_id : null,
      tax_rate: Math.max(0, Number(l.tax_rate) || 0),
    }));
  } catch {
    return null;
  }
}

export async function saveRecurring(recurringId: string | null, fd: FormData) {
  const user = await requirePermission("quotes", "edit");
  const back = recurringId ? `/sales/recurring/${recurringId}/edit` : "/sales/recurring/new";
  const frequency = str(fd, "frequency") ?? "monthly";
  const status = str(fd, "status") ?? "active";
  const fields = {
    name: str(fd, "name"),
    customer_id: str(fd, "customer_id"),
    contact_id: str(fd, "contact_id"),
    owner_id: user.seesAllSales ? str(fd, "owner_id") : user.id,
    hosting_plan_id: str(fd, "hosting_plan_id"),
    retainer_id: str(fd, "retainer_id"),
    frequency,
    next_date: str(fd, "next_date"),
    end_date: str(fd, "end_date"),
    status,
    auto_issue: bool(fd, "auto_issue"),
    business_unit: str(fd, "business_unit"),
    customer_reference: str(fd, "customer_reference"),
    notes: str(fd, "notes"),
    internal_notes: str(fd, "internal_notes"),
  };
  const lines = parseLines(fd);
  if (!fields.name) fail(back, "Please give it a name, e.g. “Website hosting”");
  if (!fields.customer_id) fail(back, "Please choose a customer");
  if (!fields.next_date) fail(back, "Please choose the date of the next invoice");
  if (!frequencies.some((f) => f.value === frequency)) fail(back, "Unknown frequency");
  if (!recurringStatuses.some((s) => s.value === status)) fail(back, "Unknown status");
  if (!lines) fail(back, "The lines couldn't be read — please try again");
  if (lines.length === 0) fail(back, "Please add at least one line");

  const supabase = await createClient();
  let id = recurringId;
  if (recurringId) {
    const { error } = await supabase.from("recurring_invoices").update(fields).eq("id", recurringId);
    if (error) fail(back, error.message);
  } else {
    const { data, error } = await supabase.from("recurring_invoices").insert(fields).select("id").single();
    if (error) fail(back, error.message);
    id = data.id;
  }

  // New lines first, then remove the old ones, so a failure never empties it.
  const { data: old } = await supabase.from("recurring_invoice_lines").select("id").eq("recurring_invoice_id", id!);
  const { error: insertError } = await supabase
    .from("recurring_invoice_lines")
    .insert(lines.map((l, i) => ({ ...l, recurring_invoice_id: id!, position: i })));
  if (insertError) fail(`/sales/recurring/${id}/edit`, insertError.message);
  const oldIds = (old ?? []).map((r) => r.id as string);
  if (oldIds.length) {
    const { error: deleteError } = await supabase.from("recurring_invoice_lines").delete().in("id", oldIds);
    if (deleteError) fail(`/sales/recurring/${id}/edit`, deleteError.message);
  }

  revalidatePath("/sales", "layout");
  redirect(`/sales/recurring/${id}?saved=1`);
}

export async function setRecurringStatus(recurringId: string, status: string) {
  await requirePermission("quotes", "edit");
  if (!recurringStatuses.some((s) => s.value === status)) fail(`/sales/recurring/${recurringId}`, "Unknown status");
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_invoices").update({ status }).eq("id", recurringId);
  if (error) fail(`/sales/recurring/${recurringId}`, error.message);
  revalidatePath("/sales", "layout");
  redirect(`/sales/recurring/${recurringId}?saved=1`);
}

// Create the next invoice from this template right now.
export async function generateRecurringNow(recurringId: string) {
  await requirePermission("quotes", "edit");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_recurring_invoice_now", { p_id: recurringId });
  if (error) fail(`/sales/recurring/${recurringId}`, error.message);
  if (!data) fail(`/sales/recurring/${recurringId}`, "Nothing was created — the recurring invoice isn't active");
  revalidatePath("/sales", "layout");
  redirect(`/sales/${data}?saved=1`);
}

// Admins: run the daily job immediately (creates everything that's due).
export async function runRecurringBillingNow() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_recurring_billing_now");
  if (error) fail("/sales/recurring", error.message);
  revalidatePath("/sales", "layout");
  redirect(`/sales/recurring?ran=${data ?? 0}`);
}

export async function deleteRecurring(recurringId: string) {
  await requirePermission("quotes", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_invoices").delete().eq("id", recurringId);
  if (error) fail(`/sales/recurring/${recurringId}`, error.message);
  revalidatePath("/sales", "layout");
  redirect("/sales/recurring?deleted=1");
}

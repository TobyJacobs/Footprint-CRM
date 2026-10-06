import "server-only";
import { createClient } from "@/lib/supabase/server";

// Income accounts (same codes as Zoho Books / Xero) for a product's sales account.
export async function getSalesAccounts() {
  const supabase = await createClient();
  const { data } = await supabase.from("sales_accounts").select("code, name").eq("active", true).order("code");
  return (data ?? []).map((a) => ({ code: a.code as string, name: a.name as string }));
}

export async function getTaxRates() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tax_rates")
    .select("id, name, rate, is_default")
    .eq("active", true)
    .order("is_default", { ascending: false })
    .order("rate", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, rate: Number(r.rate) }));
}

export async function getCompanySettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("company_settings").select("*").single();
  return data;
}

export async function getDocumentLines(documentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_document_lines")
    .select("*")
    .eq("document_id", documentId)
    .order("position");
  return (data ?? []).map((l) => ({
    key: l.id as string,
    product_id: l.product_id as string | null,
    description: l.description as string,
    quantity: Number(l.quantity),
    unit_price: Number(l.unit_price),
    unit_cost: l.unit_cost === null ? null : Number(l.unit_cost),
    discount_percent: Number(l.discount_percent),
    tax_rate_id: l.tax_rate_id as string | null,
    tax_rate: Number(l.tax_rate),
    line_net: Number(l.line_net),
    line_vat: Number(l.line_vat),
    line_cost: Number(l.line_cost),
    gp_override: l.gp_override === null ? null : Number(l.gp_override),
    gp_override_reason: (l.gp_override_reason ?? null) as string | null,
    gp_override_by: (l.gp_override_by ?? null) as string | null,
    gp_override_at: (l.gp_override_at ?? null) as string | null,
  }));
}

export async function getCustomerWithContacts(customerId: string) {
  const supabase = await createClient();
  const [{ data: customer }, { data: contacts }] = await Promise.all([
    supabase.from("customers").select("id, name, credit_status").eq("id", customerId).maybeSingle(),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, email, is_primary")
      .eq("customer_id", customerId)
      .is("erased_at", null)
      .order("is_primary", { ascending: false })
      .order("last_name"),
  ]);
  return { customer, contacts: contacts ?? [] };
}

export async function getSuppliers(activeOnly = true) {
  const supabase = await createClient();
  let q = supabase.from("suppliers").select("id, name").order("name");
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as { id: string; name: string }[];
}

export async function getPurchaseOrderLines(poId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_order_lines")
    .select("*")
    .eq("purchase_order_id", poId)
    .order("position");
  return (data ?? []).map((l) => ({
    key: l.id as string,
    product_id: l.product_id as string | null,
    description: l.description as string,
    quantity: Number(l.quantity),
    unit_cost: Number(l.unit_cost),
    tax_rate_id: l.tax_rate_id as string | null,
    tax_rate: Number(l.tax_rate),
    line_net: Number(l.line_net),
  }));
}

export async function getRecurringLines(recurringId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_invoice_lines")
    .select("*")
    .eq("recurring_invoice_id", recurringId)
    .order("position");
  return (data ?? []).map((l) => ({
    key: l.id as string,
    product_id: l.product_id as string | null,
    description: l.description as string,
    quantity: Number(l.quantity),
    unit_price: Number(l.unit_price),
    unit_cost: l.unit_cost === null ? null : Number(l.unit_cost),
    discount_percent: Number(l.discount_percent),
    tax_rate_id: l.tax_rate_id as string | null,
    tax_rate: Number(l.tax_rate),
    line_net: Number(l.line_net),
  }));
}

export function addDays(days: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

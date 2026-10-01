import "server-only";
import { createClient } from "@/lib/supabase/server";

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

export function addDays(days: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

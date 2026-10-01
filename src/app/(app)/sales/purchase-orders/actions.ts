"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { bool, str } from "@/lib/forms";
import { poStatuses } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";

// Purchase orders and suppliers. Every action checks the "quotes"
// permission and runs as the signed-in person.

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

type PoLine = {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  tax_rate_id: string | null;
  tax_rate: number;
};

function parseLines(fd: FormData): PoLine[] | null {
  try {
    const raw = JSON.parse(String(fd.get("lines_json") ?? "[]"));
    if (!Array.isArray(raw)) return null;
    return raw.map((l) => ({
      product_id: typeof l.product_id === "string" && l.product_id ? l.product_id : null,
      description: String(l.description ?? "").slice(0, 5000),
      quantity: Number(l.quantity) || 0,
      unit_cost: Number(l.unit_cost) || 0,
      tax_rate_id: typeof l.tax_rate_id === "string" && l.tax_rate_id ? l.tax_rate_id : null,
      tax_rate: Math.max(0, Number(l.tax_rate) || 0),
    }));
  } catch {
    return null;
  }
}

async function nextPoNumber() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("next_document_number", { p_doc_type: "purchase_order" });
  if (error || !data) throw new Error(error?.message ?? "Couldn't get a PO number");
  return data as string;
}

// New lines saved first, old ones removed after, so a failure never empties a PO.
async function replaceLines(poId: string, lines: PoLine[]): Promise<string | null> {
  const supabase = await createClient();
  const { data: old, error: readError } = await supabase
    .from("purchase_order_lines")
    .select("id")
    .eq("purchase_order_id", poId);
  if (readError) return readError.message;
  if (lines.length) {
    const { error } = await supabase
      .from("purchase_order_lines")
      .insert(lines.map((l, i) => ({ ...l, purchase_order_id: poId, position: i })));
    if (error) return error.message;
  }
  const oldIds = (old ?? []).map((r) => r.id as string);
  if (oldIds.length) {
    const { error } = await supabase.from("purchase_order_lines").delete().in("id", oldIds);
    if (error) return error.message;
  }
  return null;
}

export async function savePurchaseOrder(poId: string | null, fd: FormData) {
  await requirePermission("quotes", "edit");
  const back = poId ? `/sales/purchase-orders/${poId}/edit` : "/sales/purchase-orders/new";
  const fields = {
    supplier_id: str(fd, "supplier_id"),
    sales_document_id: str(fd, "sales_document_id"),
    owner_id: str(fd, "owner_id"),
    issue_date: str(fd, "issue_date"),
    expected_date: str(fd, "expected_date"),
    supplier_reference: str(fd, "supplier_reference"),
    deliver_to: str(fd, "deliver_to"),
    notes: str(fd, "notes"),
    internal_notes: str(fd, "internal_notes"),
  };
  const lines = parseLines(fd);
  if (!fields.supplier_id) fail(back, "Please choose a supplier");
  if (!lines) fail(back, "The lines couldn't be read — please try again");
  if (lines.length === 0) fail(back, "Please add at least one line");

  const supabase = await createClient();
  let id = poId;
  if (poId) {
    const { data: existing } = await supabase.from("purchase_orders").select("status").eq("id", poId).single();
    if (existing && ["received", "closed", "cancelled"].includes(existing.status)) {
      fail(back, "This purchase order is finished and can no longer be changed");
    }
    const { error } = await supabase.from("purchase_orders").update(fields).eq("id", poId);
    if (error) fail(back, error.message);
  } else {
    let number: string;
    try {
      number = await nextPoNumber();
    } catch (e) {
      fail(back, e instanceof Error ? e.message : "Couldn't get a PO number");
    }
    const { data, error } = await supabase
      .from("purchase_orders")
      .insert({ ...fields, number, status: "draft" })
      .select("id")
      .single();
    if (error) fail(back, error.message);
    id = data.id;
  }

  const lineError = await replaceLines(id!, lines);
  if (lineError) fail(`/sales/purchase-orders/${id}/edit`, lineError);

  revalidatePath("/sales", "layout");
  redirect(`/sales/purchase-orders/${id}?saved=1`);
}

export async function setPurchaseOrderStatus(poId: string, status: string) {
  await requirePermission("quotes", "edit");
  if (!poStatuses.some((s) => s.value === status)) fail(`/sales/purchase-orders/${poId}`, "Unknown status");
  const patch: Record<string, unknown> = { status };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  if (status === "received") patch.received_at = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_orders").update(patch).eq("id", poId);
  if (error) fail(`/sales/purchase-orders/${poId}`, error.message);
  revalidatePath("/sales", "layout");
  redirect(`/sales/purchase-orders/${poId}?saved=1`);
}

export async function deletePurchaseOrder(poId: string) {
  await requirePermission("quotes", "delete");
  const supabase = await createClient();
  const { data: po } = await supabase.from("purchase_orders").select("status").eq("id", poId).single();
  if (po && po.status !== "draft") {
    fail(`/sales/purchase-orders/${poId}`, "Only draft purchase orders can be deleted — cancel it instead");
  }
  const { error } = await supabase.from("purchase_orders").delete().eq("id", poId);
  if (error) fail(`/sales/purchase-orders/${poId}`, error.message);
  revalidatePath("/sales", "layout");
  redirect("/sales/purchase-orders?deleted=1");
}

// From a sales order: one draft PO per supplier, using each product's
// supplier and our cost. Lines without a supplier are skipped.
export async function raisePurchaseOrders(salesOrderId: string) {
  await requirePermission("quotes", "edit");
  const back = `/sales/${salesOrderId}`;
  const supabase = await createClient();

  const { data: so } = await supabase
    .from("sales_documents")
    .select("id, number, doc_type, customer_id, owner_id, deadline_date, delivery_type, customers!sales_documents_customer_id_fkey(name)")
    .eq("id", salesOrderId)
    .single();
  if (!so || so.doc_type !== "sales_order") fail(back, "Purchase orders can only be raised from a sales order");

  const { data: lines } = await supabase
    .from("sales_document_lines")
    .select("product_id, description, quantity, unit_cost, tax_rate_id, tax_rate, position, products(supplier_id)")
    .eq("document_id", salesOrderId)
    .order("position");

  const bySupplier = new Map<string, PoLine[]>();
  for (const l of lines ?? []) {
    const supplierId = (l.products as unknown as { supplier_id: string | null } | null)?.supplier_id;
    if (!supplierId) continue;
    const list = bySupplier.get(supplierId) ?? [];
    list.push({
      product_id: l.product_id,
      description: l.description,
      quantity: Number(l.quantity),
      unit_cost: Number(l.unit_cost ?? 0),
      tax_rate_id: l.tax_rate_id,
      tax_rate: Number(l.tax_rate),
    });
    bySupplier.set(supplierId, list);
  }
  if (bySupplier.size === 0) {
    fail(back, "None of this order's lines have a product with a supplier — raise a purchase order by hand instead");
  }

  const customerName = (so.customers as unknown as { name: string } | null)?.name ?? "";
  const created: string[] = [];
  for (const [supplierId, poLines] of bySupplier) {
    let number: string;
    try {
      number = await nextPoNumber();
    } catch (e) {
      fail(back, e instanceof Error ? e.message : "Couldn't get a PO number");
    }
    const { data: po, error } = await supabase
      .from("purchase_orders")
      .insert({
        number,
        status: "draft",
        supplier_id: supplierId,
        sales_document_id: so.id,
        customer_id: so.customer_id,
        owner_id: so.owner_id,
        expected_date: so.deadline_date,
        deliver_to: so.delivery_type === "Direct to Customer" ? `Direct to customer: ${customerName}` : "Footprint Group",
        internal_notes: `Raised for sales order ${so.number}`,
      })
      .select("id")
      .single();
    if (error) fail(back, error.message);
    const lineError = await replaceLines(po.id, poLines);
    if (lineError) fail(back, lineError);
    created.push(po.id);
  }

  revalidatePath("/sales", "layout");
  redirect(created.length === 1 ? `/sales/purchase-orders/${created[0]}?saved=1` : `/sales/purchase-orders?saved=1&for=${so.id}`);
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

export async function saveSupplier(supplierId: string | null, fd: FormData) {
  await requirePermission("quotes", "edit");
  const back = supplierId ? `/sales/suppliers/${supplierId}` : "/sales/suppliers/new";
  const fields = {
    name: str(fd, "name"),
    contact_name: str(fd, "contact_name"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    account_reference: str(fd, "account_reference"),
    notes: str(fd, "notes"),
    active: bool(fd, "active"),
  };
  if (!fields.name) fail(back, "Please give the supplier a name");
  const supabase = await createClient();
  const { error } = supplierId
    ? await supabase.from("suppliers").update(fields).eq("id", supplierId)
    : await supabase.from("suppliers").insert(fields);
  if (error) fail(back, error.code === "23505" ? "A supplier with that name already exists" : error.message);
  revalidatePath("/sales/suppliers");
  redirect("/sales/suppliers?saved=1");
}

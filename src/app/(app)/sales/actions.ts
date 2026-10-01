"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { bool, int, num, str } from "@/lib/forms";
import { defaultStatus, docTypes, isDocType, isLockedRecord, statuses, type DocType } from "@/lib/sales/options";

const isFinalised = (status: string) => ["accepted", "converted", "paid", "void", "invoiced"].includes(status);
import { createClient } from "@/lib/supabase/server";

// Every action checks the "quotes" permission and runs as the signed-in
// person, so the database's own rules apply as well.

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

function headerFields(fd: FormData, docType: DocType) {
  return {
    customer_id: str(fd, "customer_id"),
    contact_id: str(fd, "contact_id"),
    owner_id: str(fd, "owner_id"),
    title: str(fd, "title"),
    customer_reference: str(fd, "customer_reference"),
    issue_date: str(fd, "issue_date"),
    valid_until: docType === "quote" ? str(fd, "valid_until") : null,
    due_date: docType === "invoice" ? str(fd, "due_date") : null,
    deadline_date: docType === "sales_order" ? str(fd, "deadline_date") : null,
    business_unit: str(fd, "business_unit"),
    probability: docType === "quote" ? str(fd, "probability") : null,
    expected_date: str(fd, "expected_date"),
    delivery_type: str(fd, "delivery_type"),
    reason_for_loss: docType === "quote" ? str(fd, "reason_for_loss") : null,
    labour_cost: num(fd, "labour_cost"),
    production_step: docType === "sales_order" ? str(fd, "production_step") : null,
    copy_shop_job: docType === "sales_order" ? bool(fd, "copy_shop_job") : false,
    consumer_copy_shop: docType === "sales_order" ? bool(fd, "consumer_copy_shop") : false,
    copy_shop_minutes: docType === "sales_order" ? int(fd, "copy_shop_minutes") : null,
    collected: docType === "invoice" ? bool(fd, "collected") : false,
    credit_reason: docType === "credit_note" ? str(fd, "credit_reason") : null,
    notes: str(fd, "notes"),
    terms: str(fd, "terms"),
    internal_notes: str(fd, "internal_notes"),
  };
}

// Replace a document's lines: new lines are saved first, old ones removed
// afterwards, so a failure never leaves a document empty.
async function replaceLines(documentId: string, lines: LineIn[]): Promise<string | null> {
  const supabase = await createClient();
  const { data: old, error: readError } = await supabase
    .from("sales_document_lines")
    .select("id")
    .eq("document_id", documentId);
  if (readError) return readError.message;

  if (lines.length) {
    const { error } = await supabase
      .from("sales_document_lines")
      .insert(lines.map((l, i) => ({ ...l, document_id: documentId, position: i })));
    if (error) return error.message;
  }
  const oldIds = (old ?? []).map((r) => r.id as string);
  if (oldIds.length) {
    const { error } = await supabase.from("sales_document_lines").delete().in("id", oldIds);
    if (error) return error.message;
  }
  return null;
}

async function nextNumber(docType: DocType) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("next_document_number", { p_doc_type: docType });
  if (error || !data) throw new Error(error?.message ?? "Couldn't get a document number");
  return data as string;
}

export async function saveDocument(docType: DocType, documentId: string | null, fd: FormData) {
  await requirePermission("quotes", "edit");
  if (!isDocType(docType)) throw new Error("Unknown document type");
  const back = documentId ? `/sales/${documentId}/edit` : `/sales/new?type=${docType}`;

  const fields = headerFields(fd, docType);
  const lines = parseLines(fd);
  if (!fields.customer_id) fail(back, "Please choose a customer");
  if (!lines) fail(back, "The lines couldn't be read — please try again");
  if (lines.length === 0) fail(back, "Please add at least one line");

  const supabase = await createClient();
  let id = documentId;
  if (documentId) {
    const { data: existing } = await supabase.from("sales_documents").select("status").eq("id", documentId).single();
    if (existing && (isFinalised(existing.status) || isLockedRecord(docType, existing.status))) {
      fail(back, "This document is finalised and can no longer be changed");
    }
    const { error } = await supabase.from("sales_documents").update(fields).eq("id", documentId);
    if (error) fail(back, error.message);
  } else {
    let number: string;
    try {
      number = await nextNumber(docType);
    } catch (e) {
      fail(back, e instanceof Error ? e.message : "Couldn't get a document number");
    }
    const { data, error } = await supabase
      .from("sales_documents")
      .insert({ ...fields, doc_type: docType, number, status: defaultStatus[docType] })
      .select("id")
      .single();
    if (error) fail(back, error.message);
    id = data.id;
  }

  const lineError = await replaceLines(id!, lines);
  if (lineError) fail(`/sales/${id}/edit`, lineError);

  revalidatePath("/sales", "layout");
  redirect(`/sales/${id}?saved=1`);
}

export async function setDocumentStatus(documentId: string, status: string) {
  await requirePermission("quotes", "edit");
  const supabase = await createClient();
  const { data: doc } = await supabase.from("sales_documents").select("doc_type").eq("id", documentId).single();
  if (!doc || !isDocType(doc.doc_type)) fail(`/sales/${documentId}`, "Document not found");
  if (!statuses[doc.doc_type as DocType].some((s) => s.value === status)) fail(`/sales/${documentId}`, "Unknown status");

  const patch: Record<string, unknown> = { status };
  if (status === "sent" || status === "issued") patch.sent_at = new Date().toISOString();
  const { error } = await supabase.from("sales_documents").update(patch).eq("id", documentId);
  if (error) fail(`/sales/${documentId}`, error.message);

  revalidatePath("/sales", "layout");
  redirect(`/sales/${documentId}?saved=1`);
}

// Quote → sales order, sales order (or quote) → invoice. Copies the lines and
// links the new document back to where it came from.
export async function convertDocument(documentId: string, to: DocType) {
  await requirePermission("quotes", "edit");
  const supabase = await createClient();
  const back = `/sales/${documentId}`;

  const { data: src } = await supabase.from("sales_documents").select("*").eq("id", documentId).single();
  if (!src) fail(back, "Document not found");
  if (to === "credit_note" && !(src.doc_type === "invoice" && ["issued", "paid"].includes(src.status))) {
    fail(back, "Credit notes can only be raised against an issued or paid invoice");
  }
  const { data: srcLines } = await supabase
    .from("sales_document_lines")
    .select("product_id, description, quantity, unit_price, unit_cost, discount_percent, tax_rate_id, tax_rate, position")
    .eq("document_id", documentId)
    .order("position");

  const { data: settings } = await supabase.from("company_settings").select("*").single();
  let number: string;
  try {
    number = await nextNumber(to);
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "Couldn't get a document number");
  }

  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + (settings?.invoice_due_days ?? 30));

  const { data: created, error } = await supabase
    .from("sales_documents")
    .insert({
      doc_type: to,
      number,
      status: defaultStatus[to],
      customer_id: src.customer_id,
      contact_id: src.contact_id,
      owner_id: src.owner_id,
      source_document_id: src.id,
      title: to === "credit_note" ? `Credit for invoice ${src.number}` : src.title,
      customer_reference: src.response_po ?? src.customer_reference,
      issue_date: today.toISOString().slice(0, 10),
      due_date: to === "invoice" ? due.toISOString().slice(0, 10) : null,
      business_unit: src.business_unit,
      delivery_type: to === "invoice" || to === "credit_note" ? null : src.delivery_type,
      labour_cost: to === "credit_note" ? null : src.labour_cost,
      production_step: to === "sales_order" ? "New Sales Order" : null,
      deadline_date: to === "sales_order" ? src.deadline_date : null,
      notes:
        to === "credit_note"
          ? `This credit note relates to invoice ${src.number}.`
          : to === "invoice"
            ? (settings?.invoice_notes ?? src.notes)
            : src.notes,
      terms:
        to === "credit_note"
          ? null
          : to === "invoice"
            ? (settings?.invoice_terms ?? src.terms)
            : to === "sales_order"
              ? (settings?.order_terms ?? src.terms)
              : src.terms,
      internal_notes: src.internal_notes,
    })
    .select("id")
    .single();
  if (error) fail(back, error.message);

  if (srcLines?.length) {
    const { error: lineError } = await supabase
      .from("sales_document_lines")
      .insert(srcLines.map((l) => ({ ...l, document_id: created.id })));
    if (lineError) fail(back, lineError.message);
  }

  // Mark the source as moved on.
  const sourceStatus = src.doc_type === "quote" ? "converted" : src.doc_type === "sales_order" && to === "invoice" ? "invoiced" : null;
  if (sourceStatus) await supabase.from("sales_documents").update({ status: sourceStatus }).eq("id", src.id);

  revalidatePath("/sales", "layout");
  redirect(`/sales/${created.id}?saved=1`);
}

export async function deleteDocument(documentId: string) {
  await requirePermission("quotes", "delete");
  const supabase = await createClient();
  const { data: doc } = await supabase.from("sales_documents").select("doc_type, status").eq("id", documentId).single();
  if (!doc) fail("/sales", "Document not found");
  if (isLockedRecord(doc.doc_type as DocType, doc.status)) {
    fail(`/sales/${documentId}`, "Issued invoices and credit notes can't be deleted — void them instead (they must be kept for HMRC)");
  }
  const { error } = await supabase.from("sales_documents").delete().eq("id", documentId);
  if (error) fail(`/sales/${documentId}`, error.message);
  revalidatePath("/sales", "layout");
  redirect(`${docTypes[doc.doc_type as DocType].path}?deleted=1`);
}

// ─── Products ───────────────────────────────────────────────────────────────

export async function saveProduct(productId: string | null, fd: FormData) {
  await requirePermission("quotes", "edit");
  const back = productId ? `/sales/products/${productId}` : "/sales/products/new";
  const fields = {
    name: str(fd, "name"),
    description: str(fd, "description"),
    sku: str(fd, "sku"),
    unit: str(fd, "unit"),
    sale_price: num(fd, "sale_price") ?? 0,
    cost_price: num(fd, "cost_price"),
    supplier_id: str(fd, "supplier_id"),
    tax_rate_id: str(fd, "tax_rate_id"),
    business_unit: str(fd, "business_unit"),
    active: bool(fd, "active"),
  };
  if (!fields.name) fail(back, "Please give the product a name");

  const supabase = await createClient();
  if (productId) {
    const { error } = await supabase.from("products").update(fields).eq("id", productId);
    if (error) fail(back, error.message);
  } else {
    const { error } = await supabase.from("products").insert(fields);
    if (error) fail(back, error.message);
  }
  revalidatePath("/sales/products");
  redirect("/sales/products?saved=1");
}

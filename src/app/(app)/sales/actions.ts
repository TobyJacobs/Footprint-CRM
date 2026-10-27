"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { addDaysTo, customerDueDate, ukToday } from "@/lib/dates";
import { bool, int, num, str } from "@/lib/forms";
import { defaultStatus, docTypes, isDocType, isLockedRecord, isQuoteKind, isWarehouse, lossReasons, quoteKindLabel, statuses, type DocType } from "@/lib/sales/options";
import { gbp } from "@/lib/customers/display";
import { documentEmailText } from "@/lib/sales/email-text";
import { planPartInvoice } from "@/lib/sales/part-billing";
import { deliverDocument } from "@/lib/sales/send-document";

const isFinalised = (status: string) => ["accepted", "converted", "paid", "void", "invoiced"].includes(status);
import { createClient } from "@/lib/supabase/server";

// Every action checks the "quotes" permission and runs as the signed-in
// person, so the database's own rules apply as well.

function fail(path: string, message: string): never {
  // The message goes before any "#section", or the page never sees it.
  const [base, section] = path.split("#");
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}${section ? `#${section}` : ""}`);
}

// The only status changes allowed by hand. Anything else (for example an
// issued invoice back to draft) is refused, so legal records stay locked.
// Converting to another document sets "converted"/"invoiced" separately.
const allowedMoves: Record<DocType, Record<string, string[]>> = {
  quote: { draft: ["sent"], sent: ["accepted", "declined"] },
  sales_order: { open: ["completed", "cancelled"] },
  invoice: { draft: ["issued"], issued: ["paid", "void"] },
  credit_note: { draft: ["issued"], issued: ["void"] },
};

// What each document can be converted into, and from which statuses.
const conversions: Partial<Record<DocType, Partial<Record<DocType, string[]>>>> = {
  quote: { sales_order: ["sent", "accepted", "declined"] },
  sales_order: { invoice: ["open", "completed"] },
  invoice: { credit_note: ["issued", "paid"] },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LineIn = {
  id: string | null;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  discount_percent: number;
  tax_rate_id: string | null;
  tax_rate: number;
  magazine_issue_id: string | null;
  advert_size_id: string | null;
};

function parseLines(fd: FormData): LineIn[] | null {
  try {
    const raw = JSON.parse(String(fd.get("lines_json") ?? "[]"));
    if (!Array.isArray(raw)) return null;
    return raw.map((l) => ({
      id: typeof l.id === "string" && UUID_RE.test(l.id) ? l.id : null,
      product_id: typeof l.product_id === "string" && l.product_id ? l.product_id : null,
      description: String(l.description ?? "").slice(0, 5000),
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unit_price) || 0,
      unit_cost: l.unit_cost === null || l.unit_cost === "" || l.unit_cost === undefined ? null : Number(l.unit_cost) || 0,
      discount_percent: Math.min(100, Math.max(0, Number(l.discount_percent) || 0)),
      tax_rate_id: typeof l.tax_rate_id === "string" && l.tax_rate_id ? l.tax_rate_id : null,
      tax_rate: Math.max(0, Number(l.tax_rate) || 0),
      // Forget Me Not adverts (the database checks they're real).
      magazine_issue_id: typeof l.magazine_issue_id === "string" && UUID_RE.test(l.magazine_issue_id) ? l.magazine_issue_id : null,
      advert_size_id: typeof l.advert_size_id === "string" && UUID_RE.test(l.advert_size_id) ? l.advert_size_id : null,
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
    ...(docType === "quote" ? { quote_kind: isQuoteKind(str(fd, "quote_kind")) ? str(fd, "quote_kind") : "quote" } : {}),
    probability: docType === "quote" ? str(fd, "probability") : null,
    expected_date: str(fd, "expected_date"),
    delivery_type: str(fd, "delivery_type"),
    labour_cost: num(fd, "labour_cost"),
    copy_shop_job: docType === "sales_order" ? bool(fd, "copy_shop_job") : false,
    consumer_copy_shop: docType === "sales_order" ? bool(fd, "consumer_copy_shop") : false,
    copy_shop_minutes: docType === "sales_order" ? int(fd, "copy_shop_minutes") : null,
    // A sales order's own addresses (an invoice keeps the one it was given).
    ...(docType === "sales_order"
      ? {
          billing_address: str(fd, "billing_address"),
          delivery_address: str(fd, "delivery_address"),
          delivery_notes: str(fd, "delivery_notes"),
          warehouse: isWarehouse(str(fd, "warehouse")) ? str(fd, "warehouse") : null,
        }
      : {}),
    collected: docType === "invoice" ? bool(fd, "collected") : false,
    credit_reason: docType === "credit_note" ? str(fd, "credit_reason") : null,
    notes: str(fd, "notes"),
    terms: str(fd, "terms"),
    internal_notes: str(fd, "internal_notes"),
  };
}

// Save a document's lines. Lines that already exist are updated in place (so
// their GP override survives an edit), new lines are added, and lines that were
// removed are deleted last, so a failure never leaves a document empty.
async function replaceLines(documentId: string, lines: LineIn[]): Promise<string | null> {
  const supabase = await createClient();
  const { data: old, error: readError } = await supabase
    .from("sales_document_lines")
    .select("id")
    .eq("document_id", documentId);
  if (readError) return readError.message;

  const oldIds = new Set((old ?? []).map((r) => r.id as string));
  const keptIds = new Set<string>();
  const fresh: Omit<LineIn, "id">[] = [];
  const freshPositions: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const { id: lineId, ...fields } = lines[i];
    if (lineId && oldIds.has(lineId) && !keptIds.has(lineId)) {
      keptIds.add(lineId);
      const { error } = await supabase.from("sales_document_lines").update({ ...fields, position: i }).eq("id", lineId);
      if (error) return error.message;
    } else {
      fresh.push(fields);
      freshPositions.push(i);
    }
  }
  if (fresh.length) {
    const { error } = await supabase
      .from("sales_document_lines")
      .insert(fresh.map((f, k) => ({ ...f, document_id: documentId, position: freshPositions[k] })));
    if (error) return error.message;
  }
  const removed = [...oldIds].filter((id) => !keptIds.has(id));
  if (removed.length) {
    const { error } = await supabase.from("sales_document_lines").delete().in("id", removed);
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
  const user = await requirePermission("quotes", "edit");
  if (!isDocType(docType)) throw new Error("Unknown document type");
  const back = documentId ? `/sales/${documentId}/edit` : `/sales/new?type=${docType}`;

  const fields = headerFields(fd, docType);
  if (!user.seesAllSales) fields.owner_id = user.id;
  const lines = parseLines(fd);
  if (!fields.customer_id) fail(back, "Please choose a customer");
  if (!lines) fail(back, "The lines couldn't be read — please try again");
  if (lines.length === 0) fail(back, "Please add at least one line");

  const supabase = await createClient();
  let id = documentId;
  if (documentId) {
    const { data: existing } = await supabase.from("sales_documents").select("doc_type, status").eq("id", documentId).single();
    if (!existing) fail(back, "Document not found");
    // Use the document's real type, not the one the form says it is.
    if (isFinalised(existing.status) || isLockedRecord(existing.doc_type as DocType, existing.status)) {
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

  // "Send quote": email it straight away to the contact, with its PDF.
  if (!documentId && docType === "quote" && str(fd, "intent") === "send") {
    const [{ data: doc }, { data: settings }] = await Promise.all([
      supabase.from("sales_documents").select("number, total, quote_kind, contacts(first_name, email)").eq("id", id!).single(),
      supabase.from("company_settings").select("company_name").single(),
    ]);
    const contact = doc?.contacts as unknown as { first_name: string | null; email: string | null } | null;
    const email = contact?.email?.trim() ?? "";
    // No (valid) contact email: it stays a draft and the email box opens.
    if (!doc || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) redirect(`/sales/${id}?saved=1&noemail=1#email`);
    const { subject, message } = documentEmailText({
      type: "quote",
      label: doc.quote_kind && doc.quote_kind !== "quote" ? quoteKindLabel(doc.quote_kind) : undefined,
      number: doc.number,
      total: gbp(Number(doc.total)) ?? "",
      dueDate: null,
      contactFirstName: contact?.first_name ?? null,
      senderName: user.fullName ?? user.email,
      companyName: settings?.company_name ?? "Footprint Group",
    });
    const result = await deliverDocument(id!, { to: [email], cc: [], subject, message }, user);
    if (!result.ok) fail(`/sales/${id}#email`, result.error);
    redirect(`/sales/${id}?emailed=${result.status}`);
  }

  redirect(`/sales/${id}?saved=1`);
}

// "Mark declined" on a quote asks why (owner, 26 October 2026): the reason is
// saved with it, instead of being a box on the quote form.
export async function markQuoteDeclined(documentId: string, fd: FormData) {
  await requirePermission("quotes", "edit");
  const reason = str(fd, "reason_for_loss");
  if (!reason || !lossReasons.includes(reason)) fail(`/sales/${documentId}`, "Please choose why the quote was lost");
  const supabase = await createClient();
  const { error } = await supabase.from("sales_documents").update({ reason_for_loss: reason }).eq("id", documentId).eq("doc_type", "quote").eq("status", "sent");
  if (error) fail(`/sales/${documentId}`, error.message);
  await setDocumentStatus(documentId, "declined");
}

export async function setDocumentStatus(documentId: string, status: string) {
  await requirePermission("quotes", "edit");
  const supabase = await createClient();
  const { data: doc } = await supabase.from("sales_documents").select("doc_type, status").eq("id", documentId).single();
  if (!doc || !isDocType(doc.doc_type)) fail(`/sales/${documentId}`, "Document not found");
  const type = doc.doc_type as DocType;
  if (!statuses[type].some((s) => s.value === status)) fail(`/sales/${documentId}`, "Unknown status");
  if (!(allowedMoves[type][doc.status] ?? []).includes(status)) {
    const from = statuses[type].find((s) => s.value === doc.status)?.label ?? doc.status;
    const to = statuses[type].find((s) => s.value === status)?.label ?? status;
    fail(`/sales/${documentId}`, `A ${docTypes[type].label.toLowerCase()} can't go from "${from}" to "${to}"`);
  }

  const patch: Record<string, unknown> = { status };
  if (status === "sent" || status === "issued") patch.sent_at = new Date().toISOString();
  // Only change it if nobody else has changed it since we looked (e.g. two tabs).
  const { data: updated, error } = await supabase
    .from("sales_documents")
    .update(patch)
    .eq("id", documentId)
    .eq("status", doc.status)
    .select("id");
  if (error) fail(`/sales/${documentId}`, error.message);
  if (!updated?.length) fail(`/sales/${documentId}`, "This document was changed by someone else — please check it and try again");

  revalidatePath("/sales", "layout");
  redirect(`/sales/${documentId}?saved=1`);
}

// Quote → sales order, sales order (or quote) → invoice. Copies the lines and
// links the new document back to where it came from.
export async function convertDocument(documentId: string, to: DocType) {
  await requirePermission("quotes", "edit");
  const supabase = await createClient();
  const back = `/sales/${documentId}`;

  if (!isDocType(to)) fail(back, "Unknown document type");
  const { data: src } = await supabase.from("sales_documents").select("*").eq("id", documentId).single();
  if (!src) fail(back, "Document not found");
  if (to === "credit_note" && !(src.doc_type === "invoice" && ["issued", "paid"].includes(src.status))) {
    fail(back, "Credit notes can only be raised against an issued or paid invoice");
  }
  // An order that has been part-invoiced is finished with "Invoice the rest", not a full copy.
  if (src.doc_type === "sales_order" && to === "invoice") {
    const { count } = await supabase
      .from("sales_documents")
      .select("id", { count: "exact", head: true })
      .eq("source_document_id", src.id)
      .eq("doc_type", "invoice")
      .neq("status", "void");
    if (count) fail(back, "This order has already been part-invoiced. Use “Invoice the rest” instead.");
  }
  const allowedFrom = conversions[src.doc_type as DocType]?.[to];
  if (!allowedFrom) fail(back, "This document can't be converted to that");
  if (!allowedFrom.includes(src.status)) {
    fail(back, src.status === "converted" || src.status === "invoiced" ? "This has already been converted" : "This document can't be converted in its current status");
  }

  // Claim the source first, so a double-click or a second tab can't convert
  // it twice: only one request can move it on from its current status.
  const sourceStatus = src.doc_type === "quote" ? "converted" : src.doc_type === "sales_order" && to === "invoice" ? "invoiced" : null;
  if (sourceStatus) {
    const { data: claimed, error: claimError } = await supabase
      .from("sales_documents")
      .update({ status: sourceStatus })
      .eq("id", src.id)
      .eq("status", src.status)
      .select("id");
    if (claimError) fail(back, claimError.message);
    if (!claimed?.length) fail(back, "This has already been converted");
  }
  // If anything below fails, put the source back as it was.
  const undoClaim = async () => {
    if (sourceStatus) await supabase.from("sales_documents").update({ status: src.status }).eq("id", src.id).eq("status", sourceStatus);
  };
  const { data: srcLines } = await supabase
    .from("sales_document_lines")
    .select("product_id, description, quantity, unit_price, unit_cost, discount_percent, tax_rate_id, tax_rate, position, magazine_issue_id, advert_size_id")
    .eq("document_id", documentId)
    .order("position");

  const { data: settings } = await supabase.from("company_settings").select("*").single();
  let number: string;
  try {
    number = await nextNumber(to);
  } catch (e) {
    await undoClaim();
    fail(back, e instanceof Error ? e.message : "Couldn't get a document number");
  }

  // Addresses: a new sales order starts with the customer's; an invoice takes
  // the order's billing address.
  let addresses: Record<string, string | null> = {};
  if (to === "sales_order") {
    const { data: c } = await supabase
      .from("customers")
      .select("billing_street, billing_city, billing_county, billing_postcode, shipping_street, shipping_city, shipping_county, shipping_postcode")
      .eq("id", src.customer_id)
      .maybeSingle();
    const join = (...parts: (string | null)[]) => parts.map((p) => p?.trim()).filter(Boolean).join("\n") || null;
    const billing = c ? join(c.billing_street, c.billing_city, c.billing_county, c.billing_postcode) : null;
    const shipping = c ? join(c.shipping_street, c.shipping_city, c.shipping_county, c.shipping_postcode) : null;
    addresses = { billing_address: billing, delivery_address: shipping ?? billing };
  } else if (to === "invoice") {
    addresses = { billing_address: src.billing_address ?? null };
  }

  // Due date: the customer's own payment terms if they have any, else the company's.
  const today = ukToday();
  let due: string | null = null;
  if (to === "invoice") {
    const { data: customer } = await supabase.from("customers").select("invoice_due_days, invoice_due_terms").eq("id", src.customer_id).maybeSingle();
    due = customerDueDate(today, customer?.invoice_due_days, customer?.invoice_due_terms) ?? addDaysTo(today, settings?.invoice_due_days ?? 30);
  }

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
      issue_date: today,
      due_date: due,
      business_unit: src.business_unit,
      quote_kind: src.quote_kind ?? "quote",
      delivery_type: to === "invoice" || to === "credit_note" ? null : src.delivery_type,
      ...addresses,
      labour_cost: to === "credit_note" ? null : src.labour_cost,
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
  if (error) {
    await undoClaim();
    fail(back, error.message);
  }

  if (srcLines?.length) {
    const { error: lineError } = await supabase
      .from("sales_document_lines")
      .insert(srcLines.map((l) => ({ ...l, document_id: created.id })));
    // The new document exists now, so send them to it to check the lines.
    if (lineError) fail(`/sales/${created.id}`, `Created, but its lines couldn't be copied: ${lineError.message}`);
    // Keep any line GP overrides from the source document.
    const { error: overrideError } = await supabase.rpc("copy_line_overrides", { p_from: documentId, p_to: created.id });
    if (overrideError) fail(`/sales/${created.id}`, `Created, but line GP overrides couldn't be copied: ${overrideError.message}`);
  }

  revalidatePath("/sales", "layout");
  redirect(`/sales/${created.id}?saved=1`);
}

// Part billing (owner, 26 October 2026): invoice part of a sales order, as a £
// amount before VAT or a percentage, or "the rest". The invoice has one summary
// line (one per VAT rate if the order mixes rates), and the order only becomes
// "Invoiced" once everything has been billed.
export async function createPartInvoice(orderId: string, fd: FormData) {
  await requirePermission("quotes", "edit");
  const back = `/sales/${orderId}`;
  const supabase = await createClient();
  const { data: so } = await supabase.from("sales_documents").select("*").eq("id", orderId).eq("doc_type", "sales_order").maybeSingle();
  if (!so) fail(back, "Sales order not found");
  if (!["open", "completed"].includes(so.status)) fail(back, "This order can't be invoiced in its current status");

  const [{ data: lines }, { data: invoices }] = await Promise.all([
    supabase.from("sales_document_lines").select("tax_rate_id, tax_rate, line_net").eq("document_id", orderId),
    supabase.from("sales_documents").select("subtotal").eq("source_document_id", orderId).eq("doc_type", "invoice").neq("status", "void"),
  ]);
  const orderNet = Number(so.subtotal);
  const already = (invoices ?? []).reduce((sum, i) => sum + Number(i.subtotal), 0);
  const amount = num(fd, "amount");
  const plan = planPartInvoice(
    (lines ?? []).map((l) => ({ tax_rate_id: l.tax_rate_id, tax_rate: Number(l.tax_rate), line_net: Number(l.line_net) })),
    { net: orderNet, cost: Number(so.cost_total) },
    already,
    (invoices ?? []).length,
    str(fd, "rest") === "1" ? { rest: true } : { amount: amount ?? 0, unit: str(fd, "unit") === "percent" ? "percent" : "gbp" },
  );
  if (!plan.ok) fail(back, plan.error);
  const { bill, share, isFinal, partNo, percent } = plan;
  const heading = isFinal && partNo > 1 ? `Final invoice for order ${so.number}: the remaining` : `Part invoice ${partNo} for order ${so.number}:`;
  const description = `${heading} ${gbp(bill)} of ${gbp(orderNet)} (${percent}%)`;

  const { data: settings } = await supabase.from("company_settings").select("*").single();
  const { data: customer } = await supabase.from("customers").select("invoice_due_days, invoice_due_terms").eq("id", so.customer_id).maybeSingle();
  const today = ukToday();
  let number: string;
  try {
    number = await nextNumber("invoice");
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "Couldn't get an invoice number");
  }
  const { data: created, error } = await supabase
    .from("sales_documents")
    .insert({
      doc_type: "invoice",
      number,
      status: defaultStatus.invoice,
      customer_id: so.customer_id,
      contact_id: so.contact_id,
      owner_id: so.owner_id,
      source_document_id: so.id,
      title: so.title,
      customer_reference: so.customer_reference,
      issue_date: today,
      due_date: customerDueDate(today, customer?.invoice_due_days, customer?.invoice_due_terms) ?? addDaysTo(today, settings?.invoice_due_days ?? 30),
      business_unit: so.business_unit,
      quote_kind: so.quote_kind ?? "quote",
      billing_address: so.billing_address ?? null,
      // Costs follow the same share, so margin reports stay right.
      labour_cost: so.labour_cost === null ? null : Math.round(Number(so.labour_cost) * share * 100) / 100,
      notes: settings?.invoice_notes ?? so.notes,
      terms: settings?.invoice_terms ?? so.terms,
      internal_notes: so.internal_notes,
    })
    .select("id")
    .single();
  if (error) fail(back, error.message);

  const { error: lineError } = await supabase.from("sales_document_lines").insert(
    plan.lines.map((g, i) => ({
      document_id: created.id,
      position: i,
      description: plan.lines.length > 1 ? `${description} – items at ${g.tax_rate}% VAT` : description,
      quantity: 1,
      unit_price: g.amount,
      unit_cost: g.cost,
      discount_percent: 0,
      tax_rate_id: g.tax_rate_id,
      tax_rate: g.tax_rate,
    })),
  );
  if (lineError) fail(`/sales/${created.id}`, `Created, but its line couldn't be added: ${lineError.message}`);

  // Everything billed: the order is now invoiced.
  if (isFinal) {
    await supabase.from("sales_documents").update({ status: "invoiced" }).eq("id", so.id).in("status", ["open", "completed"]);
  }
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
    sales_account_code: str(fd, "sales_account_code"),
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

// Override a line's gross profit when the calculated figure is wrong. The
// database only lets the operations team and admins do this, and insists on a
// reason.
export async function setLineGpOverride(documentId: string, lineId: string, fd: FormData) {
  await requirePermission("quotes", "edit");
  const back = `/sales/${documentId}`;
  const gp = num(fd, "gp");
  const reason = str(fd, "reason");
  if (gp === null) fail(back, "Please enter the gross profit in pounds");
  if (!reason) fail(back, "Please say why you're overriding it");
  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_document_lines")
    .update({ gp_override: gp, gp_override_reason: reason })
    .eq("id", lineId)
    .eq("document_id", documentId);
  if (error) fail(back, error.message);
  revalidatePath("/sales", "layout");
  redirect(`${back}?saved=1`);
}

export async function clearLineGpOverride(documentId: string, lineId: string) {
  await requirePermission("quotes", "edit");
  const back = `/sales/${documentId}`;
  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_document_lines")
    .update({ gp_override: null, gp_override_reason: null })
    .eq("id", lineId)
    .eq("document_id", documentId);
  if (error) fail(back, error.message);
  revalidatePath("/sales", "layout");
  redirect(`${back}?saved=1`);
}

// Advert artwork (Wave 5, part 2): put the artwork for one advert size on an
// order into the design queue. Sales staff can do this without Design access;
// the database checks they can see the order.
export async function requestAdvertArtwork(orderId: string, sizeId: string, fd: FormData) {
  const back = `/sales/${orderId}`;
  const source = str(fd, "source");
  if (source !== "design" && source !== "customer" && source !== "repeat") fail(back, "Choose how the artwork will be done");
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_advert_artwork", {
    p_order: orderId,
    p_size: sizeId,
    p_source: source,
    p_note: str(fd, "note"),
  });
  if (error) fail(back, error.message);
  revalidatePath("/sales", "layout");
  revalidatePath("/design", "layout");
  redirect(`${back}?saved=1`);
}

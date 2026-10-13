"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { brandedHtml, isEmailTestMode, sendEmail } from "@/lib/email/sendgrid";
import { str } from "@/lib/forms";
import { docTypes, type DocType } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function addressList(value: string | null): string[] | null {
  if (!value) return [];
  const list = value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  return list.every((a) => EMAIL_RE.test(a)) ? list : null;
}

// Email a quote, sales order, invoice or credit note with its private link.
// Sending a draft quote marks it sent; sending a draft invoice/credit note issues it.
export async function sendDocumentEmail(documentId: string, fd: FormData) {
  const user = await requirePermission("quotes", "edit");
  const back = `/sales/${documentId}`;
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("sales_documents")
    .select("id, doc_type, number, status, customer_id, contact_id, public_token")
    .eq("id", documentId)
    .single();
  if (!doc) fail(back, "Document not found");
  const type = doc.doc_type as DocType;

  const to = addressList(str(fd, "to"));
  const cc = addressList(str(fd, "cc"));
  const subject = str(fd, "subject");
  const message = str(fd, "message");
  if (!to || to.length === 0) fail(back, "Please enter a valid email address to send to");
  if (cc === null) fail(back, "One of the CC addresses doesn't look right");
  if (!subject || !message) fail(back, "Please add a subject and a message");

  // Make sure the link works before sending: drafts become sent / issued.
  const newStatus =
    type === "quote" && doc.status === "draft" ? "sent" : (type === "invoice" || type === "credit_note") && doc.status === "draft" ? "issued" : null;
  if (newStatus) {
    const { error } = await supabase
      .from("sales_documents")
      .update({ status: newStatus, sent_at: new Date().toISOString() })
      .eq("id", documentId);
    if (error) fail(back, error.message);
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const link = `${origin}/${type === "quote" ? "q" : "d"}/${doc.public_token}`;
  const { data: settings } = await supabase.from("company_settings").select("company_name").single();
  const company = settings?.company_name ?? "Footprint Group";
  const label = docTypes[type].label;
  const buttonLabel = type === "quote" ? "View and approve your quote" : `View ${label.toLowerCase()} ${doc.number}`;
  const text = `${message}\n\n${buttonLabel}: ${link}`;

  const result = await sendEmail({
    to: to.join(", "),
    cc: cc.length ? cc.join(", ") : null,
    subject,
    text,
    html: brandedHtml({ text: message, buttonLabel, buttonUrl: link, companyName: company }),
    tag: type,
  });

  const status = result.ok ? (isEmailTestMode() ? "test" : "sent") : "failed";
  await supabase.from("email_log").insert({
    sales_document_id: documentId,
    customer_id: doc.customer_id,
    to_addresses: to.join(", "),
    cc_addresses: cc.length ? cc.join(", ") : null,
    subject,
    body: text,
    status,
    provider_message_id: result.ok ? result.messageId : null,
    error: result.ok ? null : result.error,
  });

  if (!result.ok) fail(back, `The email wasn't sent: ${result.error}`);

  await supabase.from("customer_activity").insert({
    customer_id: doc.customer_id,
    contact_id: doc.contact_id,
    kind: "email",
    body: `${label} ${doc.number} emailed to ${to.join(", ")} by ${user.fullName ?? user.email}${status === "test" ? " (test mode — not actually delivered)" : ""}. Subject: “${subject}”`,
  });

  revalidatePath("/sales", "layout");
  redirect(`${back}?emailed=${status}`);
}

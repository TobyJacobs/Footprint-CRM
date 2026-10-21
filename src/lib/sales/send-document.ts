import "server-only";
import { headers } from "next/headers";
import type { CurrentUser } from "@/lib/auth";
import { brandedHtml, isEmailTestMode, sendEmail } from "@/lib/email/sendgrid";
import { createClient } from "@/lib/supabase/server";
import { docTypes, type DocType } from "./options";
import { pdfFileName, renderDocumentPdf } from "./pdf";
import { loadPrintableData } from "./print-data";

export type DeliverResult = { ok: true; status: "sent" | "test" } | { ok: false; error: string };

// Email a quote, sales order, invoice or credit note with its private link and
// its PDF attached. Sending a draft quote marks it sent; sending a draft
// invoice/credit note issues it (put back to draft if the email fails).
// Addresses must already be checked. Used by the email box and "Send quote".
export async function deliverDocument(
  documentId: string,
  msg: { to: string[]; cc: string[]; subject: string; message: string },
  user: CurrentUser,
): Promise<DeliverResult> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("sales_documents")
    .select("id, doc_type, number, status, sent_at, customer_id, contact_id, public_token")
    .eq("id", documentId)
    .single();
  if (!doc) return { ok: false, error: "Document not found" };
  const type = doc.doc_type as DocType;

  // Make sure the link works before sending: drafts become sent / issued.
  const newStatus =
    type === "quote" && doc.status === "draft" ? "sent" : (type === "invoice" || type === "credit_note") && doc.status === "draft" ? "issued" : null;
  if (newStatus) {
    const { error } = await supabase
      .from("sales_documents")
      .update({ status: newStatus, sent_at: new Date().toISOString() })
      .eq("id", documentId)
      .eq("status", "draft");
    if (error) return { ok: false, error: error.message };
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const link = `${origin}/${type === "quote" ? "q" : "d"}/${doc.public_token}`;
  const { data: settings } = await supabase.from("company_settings").select("company_name").single();
  const company = settings?.company_name ?? "Footprint Group";
  const label = docTypes[type].label;
  const buttonLabel = type === "quote" ? "View and approve your quote" : `View ${label.toLowerCase()} ${doc.number}`;
  const text = `${msg.message}\n\n${buttonLabel}: ${link}`;

  // The PDF goes with it. If it can't be made, the email still goes (the link
  // works on its own) and the log says so.
  let attachments: { filename: string; content: Buffer; type: string }[] = [];
  let pdfNote: string | null = null;
  try {
    const found = await loadPrintableData(supabase, documentId);
    if (found) attachments = [{ filename: pdfFileName(found.data), content: await renderDocumentPdf(found.data), type: "application/pdf" }];
  } catch (e) {
    pdfNote = `PDF not attached: ${e instanceof Error ? e.message : "couldn't be made"}`;
  }

  const result = await sendEmail({
    to: msg.to.join(", "),
    cc: msg.cc.length ? msg.cc.join(", ") : null,
    subject: msg.subject,
    text,
    html: brandedHtml({ text: msg.message, buttonLabel, buttonUrl: link, companyName: company }),
    tag: type,
    replyTo: user.email,
    attachments,
  });

  const status = result.ok ? (isEmailTestMode() ? "test" : "sent") : "failed";
  await supabase.from("email_log").insert({
    sales_document_id: documentId,
    customer_id: doc.customer_id,
    to_addresses: msg.to.join(", "),
    cc_addresses: msg.cc.length ? msg.cc.join(", ") : null,
    subject: msg.subject,
    body: text,
    status,
    provider_message_id: result.ok ? result.messageId : null,
    error: result.ok ? pdfNote : result.error,
  });

  if (!result.ok) {
    // Nobody received it, so don't leave it issued (and locked): put it back to draft.
    if (newStatus) {
      await supabase
        .from("sales_documents")
        .update({ status: doc.status, sent_at: doc.sent_at })
        .eq("id", documentId)
        .eq("status", newStatus);
    }
    return { ok: false, error: `The email wasn't sent${newStatus ? `, so it's still a draft` : ""}: ${result.error}` };
  }

  await supabase.from("customer_activity").insert({
    customer_id: doc.customer_id,
    contact_id: doc.contact_id,
    kind: "email",
    body: `${label} ${doc.number} emailed to ${msg.to.join(", ")} by ${user.fullName ?? user.email}${attachments.length ? " (PDF attached)" : ""}${status === "test" ? " (test mode — not actually delivered)" : ""}. Subject: “${msg.subject}”`,
  });
  return { ok: true, status: status === "test" ? "test" : "sent" };
}

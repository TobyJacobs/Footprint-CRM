"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { sendEmail } from "@/lib/email/sendgrid";
import { str } from "@/lib/forms";
import { ticketNumber } from "@/lib/portal";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

// Customer support (needs the "support" permission; admins always have it).
// The database enforces the same rules.

const STATUSES = ["new", "in_progress", "done"] as const;
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const isStatus =(v: unknown): v is (typeof STATUSES)[number] => STATUSES.some((s) => s === v);

function fail(id: string, message: string): never {
  redirect(`/support/${id}?error=${encodeURIComponent(message)}`);
}

// Reply to the customer: saved in the conversation (they see it in their
// portal) and they get an email saying there's a reply.
export async function replyToCustomer(ticketId: string, fd: FormData) {
  const user = await requirePermission("support", "edit");
  const body = str(fd, "body");
  if (!body) fail(ticketId, "Please write a reply");
  const supabase = await createClient();
  const { error } = await supabase
    .from("support_messages")
    .insert({ ticket_id: ticketId, from_customer: false, author_id: user.id, body: body.slice(0, 5000) });
  if (error) fail(ticketId, error.message);

  const status = fd.get("status");
  if (isStatus(status)) await supabase.from("support_tickets").update({ status }).eq("id", ticketId);

  const { data: ticket } = await supabase.from("support_tickets").select("number, subject, contact_email").eq("id", ticketId).single();
  let emailed = "1";
  if (ticket) {
    const link = `${await siteUrl()}/portal/support/${ticketId}`;
    const sent = await sendEmail({
      to: ticket.contact_email,
      subject: `Re: ${ticket.subject} (${ticketNumber(ticket.number)})`,
      text: `Hello,\n\nWe've replied to your message "${ticket.subject}". Read it and reply in your customer portal:\n${link}\n\nFootprint Group`,
      html: `<p>Hello,</p><p>We've replied to your message “${escapeHtml(String(ticket.subject))}”.</p><p><a href="${link}">Read it and reply in your customer portal</a></p><p>Footprint Group</p>`,
      replyTo: user.email,
      tag: "support-reply",
    });
    if (!sent.ok) emailed = "0";
  }
  revalidatePath("/support", "layout");
  redirect(`/support/${ticketId}?replied=${emailed}`);
}

export async function setSupportStatus(ticketId: string, fd: FormData) {
  await requirePermission("support", "edit");
  const status = fd.get("status");
  if (!isStatus(status)) fail(ticketId, "Unknown status");
  const supabase = await createClient();
  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
  if (error) fail(ticketId, error.message);
  revalidatePath("/support", "layout");
  redirect(`/support/${ticketId}?saved=1`);
}

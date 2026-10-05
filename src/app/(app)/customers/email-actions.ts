"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { brandedHtml, isEmailTestMode, sendEmail } from "@/lib/email/postmark";
import { str } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

// Send an email to a customer's contact (usually from a template) and record
// it on the customer's timeline and in the email log.
export async function sendCustomerEmail(customerId: string, fd: FormData) {
  const user = await requirePermission("customers", "edit");
  const back = `/customers/${customerId}`;
  const to = str(fd, "to");
  const subject = str(fd, "subject");
  const message = str(fd, "message");
  const contactId = str(fd, "contact_id");
  if (!to || !EMAIL_RE.test(to)) fail(back, "Please enter a valid email address");
  if (!subject || !message) fail(back, "Please add a subject and a message");

  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("id, name").eq("id", customerId).maybeSingle();
  if (!customer) fail(back, "Customer not found");
  const { data: settings } = await supabase.from("company_settings").select("company_name").single();

  const result = await sendEmail({
    to,
    subject,
    text: message,
    html: brandedHtml({ text: message, companyName: settings?.company_name ?? "Footprint Group" }),
    tag: "customer-template",
  });
  const status = result.ok ? (isEmailTestMode() ? "test" : "sent") : "failed";

  await supabase.from("email_log").insert({
    customer_id: customerId,
    to_addresses: to,
    subject,
    body: message,
    status,
    provider_message_id: result.ok ? result.messageId : null,
    error: result.ok ? null : result.error,
  });
  if (!result.ok) fail(back, `The email wasn't sent: ${result.error}`);

  await supabase.from("customer_activity").insert({
    customer_id: customerId,
    contact_id: contactId,
    kind: "email",
    body: `Email "${subject}" sent to ${to} by ${user.fullName ?? user.email}${status === "test" ? " (test mode, not actually delivered)" : ""}.`,
  });

  revalidatePath(back);
  redirect(`${back}?emailed=${status}#email`);
}

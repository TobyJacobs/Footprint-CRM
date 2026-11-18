import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { brandedHtml, sendEmail } from "@/lib/email/sendgrid";
import { siteUrl } from "@/lib/site-url";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The portal welcome email (owner, 16 November 2026): tells a customer's
// contact that they can follow their orders, artwork and invoices in the
// customer portal, with a button to its sign-in page. There's no password:
// on that page they enter their email and get a one-time link or code.
// Sent automatically when a contact with an email is added (unless they've
// opted out of emails), and by the "Send portal link" button on a contact.
export async function sendPortalWelcome(
  supabase: Supabase,
  contactId: string,
  user: CurrentUser,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, customer_id, first_name, email, customer:customers (name)")
    .eq("id", contactId)
    .maybeSingle();
  const email = contact?.email?.trim();
  if (!contact || !email) return { ok: false, error: "This contact has no email address." };
  const company = (contact.customer as unknown as { name: string } | null)?.name ?? null;

  const link = `${await siteUrl()}/portal/login`;
  const text = [
    `Hello${contact.first_name ? ` ${contact.first_name}` : ""},`,
    `You can now follow your work with Footprint Group${company ? ` for ${company}` : ""} in your own customer portal: your quotes, orders (with your PO numbers), artwork and proofs to approve, and invoices, all in one place.`,
    `To sign in, open the portal and enter this email address (${email}). We'll email you a one-time sign-in link or code, so there's no password to remember.`,
    "If you have any questions, just reply to this email.",
    "Footprint Group",
  ].join("\n\n");
  const sent = await sendEmail({
    to: email,
    subject: "Your Footprint Group customer portal",
    text: `${text}\n\nOpen your customer portal: ${link}`,
    html: brandedHtml({ text, buttonLabel: "Open your customer portal", buttonUrl: link, companyName: "Footprint Group" }),
    tag: "portal-welcome",
  });
  if (!sent.ok) return sent;

  await supabase.from("contacts").update({ portal_invited_at: new Date().toISOString() }).eq("id", contact.id);
  await supabase.from("customer_activity").insert({
    customer_id: contact.customer_id,
    kind: "system",
    body: `Customer portal welcome email sent to ${email} by ${user.fullName ?? user.email}.`,
  });
  return { ok: true };
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { gbp } from "@/lib/customers/display";
import { brandedHtml, isEmailTestMode, sendEmail } from "@/lib/email/sendgrid";
import { str } from "@/lib/forms";
import { billingLabel } from "@/lib/sales/proposal";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

// The customer's answer to a quote, from the private approval link. The
// database function checks the link, that it hasn't been answered already and
// that the quote hasn't expired. Accepting makes the sales order, and the
// customer is emailed an order confirmation with its number.
export async function respondToQuote(token: string, accept: boolean, fd: FormData) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) redirect("/q/invalid");
  const h = await headers();
  const ip = h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const supabase = await createClient();
  const { data: problem, error } = await supabase.rpc("respond_to_quote", {
    p_token: token,
    p_accept: accept,
    p_name: str(fd, "name") ?? "",
    p_po: str(fd, "po") ?? "",
    p_note: str(fd, "note") ?? "",
    p_ip: ip ?? "",
  });

  const message = error ? "Something went wrong — please try again or contact us." : (problem as string | null);
  if (message) redirect(`/q/${token}?error=${encodeURIComponent(message)}`);
  if (accept) await sendOrderConfirmation(token);
  redirect(`/q/${token}?done=${accept ? "accepted" : "declined"}`);
}

type Confirmation = {
  order_id: string;
  order_number: string;
  order_token: string;
  quote_number: string;
  title: string | null;
  customer_reference: string | null;
  customer_name: string;
  contact_first_name: string | null;
  contact_email: string | null;
  owner_email: string | null;
  owner_name: string | null;
  company_name: string | null;
  subtotal: number;
  vat_total: number;
  total: number;
  lines: { description: string; quantity: number; line_net: number; billing: string | null }[];
};

// Order confirmation (DJ, 9 November 2026): emailed once, to the quote's
// contact, with the sales order number, what's been ordered and a link to view
// it. Replies go to the salesperson. Never stops the acceptance going through.
async function sendOrderConfirmation(token: string) {
  const key = process.env.PORTAL_LINK_KEY;
  if (!key) return;
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("order_confirmation_details", { p_key: key, p_token: token });
    const c = data as Confirmation | null;
    const to = c?.contact_email?.trim() ?? "";
    if (!c || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) return;

    const company = c.company_name ?? "Footprint Group";
    const link = `${await siteUrl()}/d/${c.order_token}`;
    const subject = `Order confirmation ${c.order_number} from ${company}`;
    const text = [
      `Hi ${c.contact_first_name || "there"},`,
      `Thank you for accepting quote ${c.quote_number}. Your order is confirmed, and your order number is ${c.order_number}.${c.customer_reference ? ` Your reference: ${c.customer_reference}.` : ""}`,
      `You can view your order at any time using the link below. If anything needs to change, just reply to this email.`,
      `Kind regards,\n${c.owner_name || company}\n${company}`,
    ].join("\n\n");
    const money = (n: number) => gbp(Number(n)) ?? "";
    const html = brandedHtml({
      text,
      buttonLabel: "View your order",
      buttonUrl: link,
      companyName: company,
      table: {
        head: ["Item", "Qty", "Amount"],
        rows: c.lines.map((l) => [
          l.billing && l.billing !== "oneoff" ? `${l.description} (${billingLabel(l.billing)})` : l.description,
          String(Number(l.quantity)),
          money(l.line_net),
        ]),
        foot: [
          ["Subtotal", "", money(c.subtotal)],
          ["VAT", "", money(c.vat_total)],
          ["Total", "", money(c.total)],
        ],
      },
    });
    const sent = await sendEmail({ to, subject, text: `${text}\n\nView your order: ${link}`, html, replyTo: c.owner_email, tag: "order-confirmation" });
    await supabase.rpc("record_order_confirmation", {
      p_key: key,
      p_order: c.order_id,
      p_to: to,
      p_subject: subject,
      p_body: text,
      p_status: sent.ok ? (isEmailTestMode() ? "test" : "sent") : "failed",
      p_message_id: sent.ok ? sent.messageId : null,
      p_error: sent.ok ? null : sent.error,
    });
    if (!sent.ok) console.error("Order confirmation email failed:", sent.error);
  } catch (e) {
    console.error("Order confirmation not sent:", e instanceof Error ? e.message : e);
  }
}

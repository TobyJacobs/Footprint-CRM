import { brandedHtml, sendEmail } from "@/lib/email/sendgrid";
import { eventDetail, verifySendGridSignature, type SendGridEvent } from "@/lib/email/webhook";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

// SendGrid's Event Webhook (owner, 9 November 2026): SendGrid reports what
// happened to each email after it left (delivered, delayed, bounced, dropped,
// spam). Each report is checked against SendGrid's signature, then recorded
// on the email (email_delivery_event). If an email bounces or is dropped,
// whoever sent it is emailed so they can fix the address and send it again.
export async function POST(request: Request) {
  const publicKey = process.env.SENDGRID_WEBHOOK_KEY;
  const key = process.env.PORTAL_LINK_KEY;
  if (!publicKey || !key) return new Response("Not set up", { status: 503 });

  const payload = await request.text();
  const signature = request.headers.get("x-twilio-email-event-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-twilio-email-event-webhook-timestamp") ?? "";
  if (!signature || !timestamp || payload.length > 2_000_000 || !verifySendGridSignature(publicKey, payload, signature, timestamp)) {
    return new Response("Bad signature", { status: 403 });
  }

  let events: SendGridEvent[];
  try {
    const parsed = JSON.parse(payload) as unknown;
    events = Array.isArray(parsed) ? (parsed as SendGridEvent[]) : [];
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const supabase = await createClient();
  const site = await siteUrl();
  for (const e of events.slice(0, 1000)) {
    if (!e.event || !e.sg_message_id) continue;
    const { data, error } = await supabase.rpc("email_delivery_event", {
      p_key: key,
      p_message_id: e.sg_message_id,
      p_event: e.event,
      p_detail: eventDetail(e),
      p_at: e.timestamp ? new Date(e.timestamp * 1000).toISOString() : null,
    });
    if (error) {
      console.error("Email event not recorded:", error.message);
      continue;
    }
    const failed = data as { to: string; subject: string; detail: string | null; sales_document_id: string | null; purchase_order_id: string | null; customer_id: string | null; sender_email: string | null } | null;
    const tellWho = failed ? (failed.sender_email ?? process.env.EMAIL_REPLY_TO ?? null) : null;
    if (failed && tellWho) {
      const link = failed.sales_document_id
        ? `${site}/sales/${failed.sales_document_id}`
        : failed.purchase_order_id
          ? `${site}/sales/purchase-orders/${failed.purchase_order_id}`
          : failed.customer_id
            ? `${site}/customers/${failed.customer_id}`
            : site;
      const text = `Your email "${failed.subject}" to ${failed.to} didn't arrive: the customer's mail server turned it away.${failed.detail ? `\n\nTheir server said: ${failed.detail}` : ""}\n\nPlease check the email address and send it again.`;
      const sent = await sendEmail({
        to: tellWho,
        subject: `Not delivered: ${failed.subject}`.slice(0, 150),
        text: `${text}\n\n${link}`,
        html: brandedHtml({ text, buttonLabel: "Open it in FootprintOS", buttonUrl: link, companyName: "Footprint Group" }),
        tag: "bounce-alert",
      });
      if (!sent.ok) console.error("Bounce alert email failed:", sent.error);
    }
  }
  return new Response("OK");
}

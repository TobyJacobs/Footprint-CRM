import "server-only";

// Sends email through SendGrid (https://sendgrid.com).
//
// Settings (Netlify environment variables, and .env.local on your computer):
//   SENDGRID_API_KEY  - secret; set in Netlify only (a key with "Mail Send"
//                       permission).
//   EMAIL_FROM        - e.g. "Footprint Group <accounts@footprintgroup.uk>".
//                       Must be a verified sender (or on an authenticated
//                       domain) in SendGrid.
//   EMAIL_REPLY_TO    - optional reply-to address.
//   EMAIL_TEST_MODE   - set to "true" to use SendGrid's sandbox: messages are
//                       checked and accepted but never delivered.

export const isEmailConfigured = () => Boolean(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM);
export const isEmailTestMode = () => process.env.EMAIL_TEST_MODE === "true";

export type SendResult = { ok: true; messageId: string | null } | { ok: false; error: string };

// "Name <a@b.com>" or just "a@b.com" -> SendGrid's {email, name}.
function parseAddress(v: string): { email: string; name?: string } {
  const m = v.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2].trim(), name: m[1].replace(/^"|"$/g, "") || undefined };
  return { email: v.trim() };
}

export async function sendEmail(msg: {
  to: string;
  cc?: string | null;
  subject: string;
  text: string;
  html: string;
  tag?: string;
}): Promise<SendResult> {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: "Email isn't set up yet (no SendGrid settings)." };

  const cc = msg.cc ? parseAddress(msg.cc) : null;
  const to = parseAddress(msg.to);
  const replyTo = process.env.EMAIL_REPLY_TO;

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [
          {
            to: [to],
            ...(cc && cc.email.toLowerCase() !== to.email.toLowerCase() ? { cc: [cc] } : {}),
          },
        ],
        from: parseAddress(from),
        ...(replyTo ? { reply_to: parseAddress(replyTo) } : {}),
        subject: msg.subject,
        content: [
          { type: "text/plain", value: msg.text },
          { type: "text/html", value: msg.html },
        ],
        ...(msg.tag ? { categories: [msg.tag] } : {}),
        ...(isEmailTestMode() ? { mail_settings: { sandbox_mode: { enable: true } } } : {}),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { errors?: { message?: string }[] };
      return { ok: false, error: body.errors?.[0]?.message ?? `SendGrid error (${res.status})` };
    }
    return { ok: true, messageId: res.headers.get("x-message-id") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't reach SendGrid" };
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A simple, branded HTML version of a plain-text message, with an optional
// button and an optional table (e.g. the lines of a purchase order).
export function brandedHtml(opts: {
  text: string;
  buttonLabel?: string;
  buttonUrl?: string;
  companyName: string;
  table?: { head: string[]; rows: string[][]; foot?: string[][] };
}) {
  const paragraphs = escapeHtml(opts.text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const cell = (v: string, i: number, tag = "td", bold = false) =>
    `<${tag} style="padding:6px 8px;border-bottom:1px solid #eee;text-align:${i === 0 ? "left" : "right"};${bold ? "font-weight:700;" : ""}">${escapeHtml(v).replace(/\n/g, "<br>")}</${tag}>`;
  const table = opts.table
    ? `<p style="margin:18px 0 4px;font-weight:700">Order details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin:0 0 18px;border-collapse:collapse">
<tr style="color:#888;font-size:11px;text-transform:uppercase">${opts.table.head.map((h, i) => cell(h, i, "th")).join("")}</tr>
${opts.table.rows.map((r) => `<tr>${r.map((v, i) => cell(v, i)).join("")}</tr>`).join("")}
${(opts.table.foot ?? []).map((r) => `<tr>${r.map((v, i) => cell(v, i, "td", true)).join("")}</tr>`).join("")}
</table>`
    : "";
  const button =
    opts.buttonUrl && opts.buttonLabel
      ? `<p style="margin:22px 0"><a href="${escapeHtml(opts.buttonUrl)}" style="background:#de2277;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px;display:inline-block">${escapeHtml(opts.buttonLabel)}</a></p>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#f7f7f7;font-family:Montserrat,Arial,sans-serif;color:#000">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="height:4px;background:linear-gradient(90deg,#de2277,#e58207,#7bcbd1)"></td></tr>
<tr><td style="padding:28px 28px 8px;font-size:15px;line-height:1.55">${paragraphs}${table}${button}
</td></tr>
<tr><td style="padding:12px 28px 24px;font-size:12px;color:#888">${escapeHtml(opts.companyName)}</td></tr>
</table></td></tr></table></body></html>`;
}

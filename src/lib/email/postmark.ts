import "server-only";

// Sends email through Postmark (https://postmarkapp.com).
//
// Settings (Netlify environment variables, and .env.local on your computer):
//   POSTMARK_SERVER_TOKEN  — secret; set in Netlify only. The special value
//                            "POSTMARK_API_TEST" is Postmark's test mode:
//                            emails are accepted but never delivered.
//   EMAIL_FROM             — e.g. "Footprint Group <accounts@footprintgroup.uk>".
//                            Must be a verified sender in Postmark.
//   EMAIL_REPLY_TO         — optional reply-to address.

export const isEmailConfigured = () => Boolean(process.env.POSTMARK_SERVER_TOKEN && process.env.EMAIL_FROM);
export const isEmailTestMode = () => process.env.POSTMARK_SERVER_TOKEN === "POSTMARK_API_TEST";

export type SendResult = { ok: true; messageId: string | null } | { ok: false; error: string };

export async function sendEmail(msg: {
  to: string;
  cc?: string | null;
  subject: string;
  text: string;
  html: string;
  tag?: string;
}): Promise<SendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const from = process.env.EMAIL_FROM;
  if (!token || !from) return { ok: false, error: "Email isn't set up yet (no Postmark settings)." };

  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify({
        From: from,
        To: msg.to,
        Cc: msg.cc || undefined,
        ReplyTo: process.env.EMAIL_REPLY_TO || undefined,
        Subject: msg.subject,
        TextBody: msg.text,
        HtmlBody: msg.html,
        Tag: msg.tag,
        MessageStream: "outbound",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { ErrorCode?: number; Message?: string; MessageID?: string };
    if (!res.ok || (body.ErrorCode && body.ErrorCode !== 0)) {
      return { ok: false, error: body.Message ?? `Postmark error (${res.status})` };
    }
    return { ok: true, messageId: body.MessageID ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't reach Postmark" };
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

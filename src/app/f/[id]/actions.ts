"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendEmail } from "@/lib/email/sendgrid";
import { str } from "@/lib/forms";
import { PUBLIC_ID_RE, checkStamp } from "@/lib/lead-forms";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Someone sends a website enquiry form. It becomes a lead (or is added to
// their open lead), and the form's owner and chosen people are emailed.
export async function submitEnquiry(publicId: string, embed: boolean, fd: FormData) {
  if (!PUBLIC_ID_RE.test(publicId)) redirect("/");
  const base = `/f/${publicId}${embed ? "?embed=1&" : "?"}`;
  const thanks = `${base}sent=1`;

  // Spam traps: a hidden box only bots fill in, and sending too quickly.
  // Bots are shown the thank-you page so they don't try again.
  if (str(fd, "website")) redirect(thanks);
  const stamp = checkStamp(publicId, str(fd, "t"));
  if (stamp === "too-fast") redirect(thanks);
  if (stamp === "stale") redirect(`${base}error=${encodeURIComponent("Sorry, this form timed out. Please try again.")}`);

  const key = process.env.PORTAL_LINK_KEY;
  if (!key) redirect(`${base}error=${encodeURIComponent("Sorry, we can't take enquiries right now. Please email us instead.")}`);
  const h = await headers();
  const ip = h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ipHash = ip ? createHash("sha256").update(`${key}:${ip}`).digest("hex") : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_lead_form", {
    p_key: key,
    p_public_id: publicId,
    p_name: str(fd, "name") ?? "",
    p_email: str(fd, "email") ?? "",
    p_phone: str(fd, "phone") ?? "",
    p_company: str(fd, "company") ?? "",
    p_message: str(fd, "message") ?? "",
    p_page: str(fd, "page")?.slice(0, 300) ?? "",
    p_ip_hash: ipHash,
  });
  if (error) {
    // Only our own plain messages are shown to the public; anything else is logged.
    const shown: Record<string, string> = {
      "Too many enquiries": "Thanks, we've already got your message. Please try again later if you need to send another.",
      "Please give your name and a valid email address": "Please give your name and a valid email address.",
      "This form is no longer taking enquiries": "Sorry, this form isn't taking enquiries any more.",
    };
    if (!shown[error.message]) console.error("Website enquiry refused:", error.message);
    redirect(`${base}error=${encodeURIComponent(shown[error.message] ?? "Sorry, we can't take enquiries right now. Please email us instead.")}`);
  }

  const result = data as { lead_id: string; pipeline_id: string; form_name: string; repeat: boolean; notify: string[] };
  if (result.notify.length) {
    const name = str(fd, "name") ?? "";
    const lines = [
      `Name: ${name}`,
      `Email: ${str(fd, "email") ?? ""}`,
      str(fd, "phone") && `Phone: ${str(fd, "phone")}`,
      str(fd, "company") && `Business: ${str(fd, "company")}`,
      str(fd, "page") && `From: ${str(fd, "page")}`,
    ].filter(Boolean) as string[];
    const message = str(fd, "message")?.slice(0, 3000) ?? "";
    const link = `${await siteUrl()}/leads?p=${result.pipeline_id}&open=${result.lead_id}`;
    const intro = result.repeat
      ? `${name} has sent another enquiry through "${result.form_name}". It's been added to their open lead.`
      : `New enquiry through "${result.form_name}". It's a new lead in FootprintOS.`;
    const sent = await sendEmail({
      to: result.notify.join(", "),
      subject: `Website enquiry: ${name}`.slice(0, 150),
      text: `${intro}\n\n${lines.join("\n")}${message ? `\n\n${message}` : ""}\n\nOpen the lead: ${link}`,
      html: `<p>${escapeHtml(intro)}</p><p>${lines.map(escapeHtml).join("<br>")}</p>${message ? `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ""}<p><a href="${link}">Open the lead in FootprintOS</a></p>`,
      replyTo: str(fd, "email"),
      tag: "website-enquiry",
    });
    if (!sent.ok) console.error("Website enquiry email failed:", sent.error);
  }
  redirect(thanks);
}

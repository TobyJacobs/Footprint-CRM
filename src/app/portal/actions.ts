"use server";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sendEmail } from "@/lib/email/sendgrid";
import { PORTAL_COOKIE, PORTAL_EMAIL_COOKIE, PORTAL_SESSION_DAYS, getPortalSession, getPortalTicket, ticketKindLabel, ticketNumber } from "@/lib/portal";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

// Email a one-time sign-in link. The page always says "check your inbox", so
// nobody can use it to find out who is a customer.
export async function requestPortalLink(fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/portal/login?error=email");

  // PORTAL_LINK_KEY (Netlify only, secret) proves to the database that this is
  // FootprintOS asking; the database keeps only its fingerprint.
  const key = process.env.PORTAL_LINK_KEY;
  if (!key) redirect("/portal/login?error=setup");

  // The button's token and a 6-digit code for typing on another device (e.g.
  // email read on a phone, signing in on a laptop). The database gets only
  // fingerprints; the code's is mixed with the token's.
  const token = randomBytes(32).toString("hex");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const tokenHash = sha256(token);
  const supabase = await createClient();
  const { data: ok, error } = await supabase.rpc("portal_request_link", {
    p_key: key,
    p_email: email,
    p_token_hash: tokenHash,
    p_code_hash: sha256(`${tokenHash}:${code}`),
  });
  if (error) {
    console.error("Portal sign-in link refused:", error.message);
    redirect("/portal/login?error=setup");
  }

  if (ok === true) {
    const link = `${await siteUrl()}/portal/sign-in/${token}`;
    const text = [
      "Hello,",
      "",
      "Here's your link to sign in to the Footprint Group customer portal:",
      link,
      "",
      `Or type this code on the sign-in screen: ${code}`,
      "",
      "They work once and stop working after 30 minutes. If you didn't ask for this, you can ignore this email.",
      "",
      "Footprint Group",
    ].join("\n");
    const html = `<p>Hello,</p><p>Here's your link to sign in to the Footprint Group customer portal:</p><p><a href="${link}" style="display:inline-block;background:#de2277;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Sign in to your portal</a></p><p>Or type this code on the sign-in screen (handy if you're reading this on another device):</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>They work once and stop working after 30 minutes. If you didn't ask for this, you can ignore this email.</p><p>Footprint Group</p>`;
    const sent = await sendEmail({ to: email, subject: "Your Footprint Group sign-in link", text, html, tag: "portal-sign-in" });
    if (!sent.ok) console.error("Portal sign-in email failed:", sent.error);
  }
  // Remember the email (in a private cookie, not the address bar) so the code
  // box knows whose code it is. Set whatever the answer, so the page can't be
  // used to find out who is a customer.
  (await cookies()).set(PORTAL_EMAIL_COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/portal",
    maxAge: 30 * 60,
  });
  redirect("/portal/login?sent=1");
}

async function startSession(session: string) {
  const jar = await cookies();
  jar.set(PORTAL_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_SESSION_DAYS * 24 * 60 * 60,
  });
  jar.delete({ name: PORTAL_EMAIL_COOKIE, path: "/portal" });
  redirect("/portal");
}

// The 6-digit code typed on the "check your inbox" screen.
export async function signInWithCode(fd: FormData) {
  const email = (await cookies()).get(PORTAL_EMAIL_COOKIE)?.value;
  if (!email) redirect("/portal/login?error=expired");
  const code = String(fd.get("code") ?? "").replace(/\D/g, "");
  const supabase = await createClient();
  const { data: session } = await supabase.rpc("portal_sign_in_code", { p_email: email, p_code: code });
  if (typeof session !== "string" || !session) redirect("/portal/login?sent=1&error=code");
  await startSession(session);
}

// The customer clicked Sign in on the link's page. (A button rather than the
// link itself, so email scanners that open links can't use it up.)
export async function signInWithLink(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) redirect("/portal/login?error=link");
  const supabase = await createClient();
  const { data: session } = await supabase.rpc("portal_sign_in", { p_link: token });
  if (typeof session !== "string" || !session) redirect("/portal/login?error=link");
  await startSession(session);
}

// ─── Customer support ───────────────────────────────────────────────────────

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Email everyone who works on customer support that a message has arrived.
async function alertSupportTeam(ticketId: string, intro: string, body: string) {
  const key = process.env.PORTAL_LINK_KEY;
  if (!key) return;
  const supabase = await createClient();
  const { data: recipients, error } = await supabase.rpc("portal_support_alert_recipients", { p_key: key });
  if (error || !Array.isArray(recipients) || recipients.length === 0) {
    if (error) console.error("Support alert recipients:", error.message);
    return;
  }
  const ticket = await getPortalTicket(ticketId);
  if (!ticket) return;
  const link = `${await siteUrl()}/support/${ticketId}`;
  const heading = `${ticketNumber(ticket.number)} · ${ticketKindLabel(ticket.kind)} from ${ticket.customer_name}: ${ticket.subject}`;
  const excerpt = body.length > 1000 ? `${body.slice(0, 1000)}…` : body;
  const sent = await sendEmail({
    to: (recipients as string[]).join(", "),
    subject: `Customer support: ${heading}`,
    text: `${intro}\n\n${heading}\n\n${excerpt}\n\nOpen it in FootprintOS: ${link}`,
    html: `<p>${escapeHtml(intro)}</p><p><strong>${escapeHtml(heading)}</strong></p><p style="white-space:pre-wrap">${escapeHtml(excerpt)}</p><p><a href="${link}">Open it in FootprintOS</a></p>`,
    tag: "support-alert",
  });
  if (!sent.ok) console.error("Support alert email failed:", sent.error);
}

export async function createSupportTicket(fd: FormData) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const body = String(fd.get("body") ?? "").trim();
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("portal_create_ticket", {
    p_session: session,
    p_customer_id: String(fd.get("customer_id") ?? ""),
    p_kind: fd.get("kind") === "change" ? "change" : "question",
    p_subject: String(fd.get("subject") ?? "").trim(),
    p_body: body,
  });
  if (error || typeof id !== "string") redirect(`/portal/support/new?error=${encodeURIComponent(error?.message ?? "Something went wrong")}`);
  await alertSupportTeam(id, "A customer has sent a new message from their portal.", body);
  redirect(`/portal/support/${id}?sent=1`);
}

export async function replyToSupportTicket(ticketId: string, fd: FormData) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const body = String(fd.get("body") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_reply", { p_session: session, p_ticket_id: ticketId, p_body: body });
  if (error) redirect(`/portal/support/${ticketId}?error=${encodeURIComponent(error.message)}`);
  await alertSupportTeam(ticketId, "A customer has replied in a support conversation.", body);
  redirect(`/portal/support/${ticketId}?sent=1`);
}

export async function signOutOfPortal() {
  const jar = await cookies();
  const session = jar.get(PORTAL_COOKIE)?.value;
  if (session) {
    const supabase = await createClient();
    await supabase.rpc("portal_sign_out", { p_session: session });
  }
  jar.delete(PORTAL_COOKIE);
  redirect("/portal/login?signedout=1");
}

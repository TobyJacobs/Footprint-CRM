"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sendEmail } from "@/lib/email/sendgrid";
import { PORTAL_COOKIE, PORTAL_SESSION_DAYS } from "@/lib/portal";
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

  const token = randomBytes(32).toString("hex");
  const supabase = await createClient();
  const { data: ok, error } = await supabase.rpc("portal_request_link", {
    p_key: key,
    p_email: email,
    p_token_hash: sha256(token),
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
      "It works once and stops working after 30 minutes. If you didn't ask for it, you can ignore this email.",
      "",
      "Footprint Group",
    ].join("\n");
    const html = `<p>Hello,</p><p>Here's your link to sign in to the Footprint Group customer portal:</p><p><a href="${link}" style="display:inline-block;background:#de2277;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Sign in to your portal</a></p><p>It works once and stops working after 30 minutes. If you didn't ask for it, you can ignore this email.</p><p>Footprint Group</p>`;
    const sent = await sendEmail({ to: email, subject: "Your Footprint Group sign-in link", text, html, tag: "portal-sign-in" });
    if (!sent.ok) console.error("Portal sign-in email failed:", sent.error);
  }
  redirect("/portal/login?sent=1");
}

// The customer clicked Sign in on the link's page. (A button rather than the
// link itself, so email scanners that open links can't use it up.)
export async function signInWithLink(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) redirect("/portal/login?error=link");
  const supabase = await createClient();
  const { data: session } = await supabase.rpc("portal_sign_in", { p_link: token });
  if (typeof session !== "string" || !session) redirect("/portal/login?error=link");
  (await cookies()).set(PORTAL_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_SESSION_DAYS * 24 * 60 * 60,
  });
  redirect("/portal");
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

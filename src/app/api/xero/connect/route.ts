import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { XERO_SCOPES, isXeroConfigured } from "@/lib/xero/client";

// "Connect to Xero" (admins): off to Xero's sign-in, which comes back to
// /api/xero/callback. A random value in a private cookie proves it's the
// same person coming back.
export async function GET() {
  const user = await getCurrentUser();
  const site = await siteUrl();
  if (!user.isAdmin) return NextResponse.redirect(`${site}/admin/xero?error=${encodeURIComponent("Only admins can connect Xero")}`);
  if (!isXeroConfigured()) return NextResponse.redirect(`${site}/admin/xero?error=${encodeURIComponent("Add the Xero app's details to Netlify first")}`);
  const state = randomBytes(24).toString("hex");
  const url = new URL("https://login.xero.com/identity/connect/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.XERO_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${site}/api/xero/callback`);
  url.searchParams.set("scope", XERO_SCOPES);
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set("xero_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/xero", maxAge: 600 });
  return res;
}

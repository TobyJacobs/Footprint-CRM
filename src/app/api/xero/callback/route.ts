import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { sealTokens, xeroKey, xeroTokens } from "@/lib/xero/client";

// Back from Xero's sign-in: swap the code for tokens, find the organisation
// that was chosen, and save the connection (encrypted).
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const site = await siteUrl();
  const back = (q: string) => {
    const res = NextResponse.redirect(`${site}/admin/xero?${q}`);
    res.cookies.delete({ name: "xero_state", path: "/api/xero" });
    return res;
  };
  if (!user.isAdmin) return back(`error=${encodeURIComponent("Only admins can connect Xero")}`);
  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return back(`error=${encodeURIComponent(`Xero said: ${sp.get("error_description") ?? sp.get("error")}`)}`);
  const state = sp.get("state") ?? "";
  const expected = request.cookies.get("xero_state")?.value ?? "";
  if (!state || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    return back(`error=${encodeURIComponent("The Xero sign-in timed out or didn't match. Please try again.")}`);
  }
  try {
    const tokens = await xeroTokens({ grant_type: "authorization_code", code: sp.get("code") ?? "", redirect_uri: `${site}/api/xero/callback` });
    const res = await fetch("https://api.xero.com/connections", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const orgs = ((await res.json().catch(() => [])) as { tenantId: string; tenantName: string; tenantType: string }[]).filter((t) => t.tenantType === "ORGANISATION");
    if (!orgs.length) return back(`error=${encodeURIComponent("No Xero organisation was chosen. Please try again and pick Footprint's organisation.")}`);
    const org = orgs[orgs.length - 1];
    const supabase = await createClient();
    const { error } = await supabase.rpc("xero_connect", {
      p_key: xeroKey(),
      p_tenant_id: org.tenantId,
      p_tenant_name: org.tenantName,
      p_token_blob: sealTokens(tokens),
      p_expires_at: tokens.expires_at.toISOString(),
    });
    if (error) return back(`error=${encodeURIComponent(error.message)}`);
    return back(`connected=1`);
  } catch (e) {
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : "Couldn't connect to Xero")}`);
  }
}

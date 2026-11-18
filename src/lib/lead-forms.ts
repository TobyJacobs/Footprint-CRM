import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Website enquiry forms (see the lead_forms migration). The public form page
// is /f/<public id>; this is what it may show.
export type PublicLeadForm = {
  public_id: string;
  heading: string | null;
  intro: string | null;
  button_label: string;
  thank_you: string;
  show_phone: boolean;
  show_company: boolean;
  show_message: boolean;
  privacy_url: string | null;
};

export const PUBLIC_ID_RE = /^[a-z0-9]{6,20}$/;

export async function loadPublicForm(publicId: string) {
  await connection();
  if (!PUBLIC_ID_RE.test(publicId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_lead_form", { p_public_id: publicId });
  return (data as PublicLeadForm | null) ?? null;
}

// A stamp of when the form was shown, signed so it can't be made up. Bots
// that submit within a few seconds of loading the page are quietly ignored.
const sign = (key: string, publicId: string, at: number) =>
  createHmac("sha256", key).update(`${publicId}.${at}`).digest("hex");

export function formStamp(publicId: string): string {
  const key = process.env.PORTAL_LINK_KEY ?? "";
  const at = Date.now();
  return `${at}.${sign(key, publicId, at)}`;
}

// "ok", "too-fast" (a bot: pretend it worked) or "stale" (shown over a day ago,
// or tampered with: ask them to try again).
export function checkStamp(publicId: string, stamp: string | null): "ok" | "too-fast" | "stale" {
  const key = process.env.PORTAL_LINK_KEY ?? "";
  const m = /^(\d{10,16})\.([0-9a-f]{64})$/.exec(stamp ?? "");
  if (!m) return "stale";
  const at = Number(m[1]);
  const expected = Buffer.from(sign(key, publicId, at), "hex");
  if (!timingSafeEqual(expected, Buffer.from(m[2], "hex"))) return "stale";
  const age = Date.now() - at;
  if (age < 3000) return "too-fast";
  return age > 24 * 60 * 60 * 1000 ? "stale" : "ok";
}

// The snippet to paste into a website: the form in a frame that grows to fit.
export function embedCode(site: string, publicId: string) {
  const id = `fpos-form-${publicId}`;
  return `<iframe id="${id}" src="${site}/f/${publicId}?embed=1" title="Enquiry form" loading="lazy" style="width:100%;min-height:560px;border:0"></iframe>
<script>addEventListener("message",function(e){if(e.origin==="${site}"&&e.data&&e.data.fposForm==="${publicId}"){document.getElementById("${id}").style.height=e.data.height+"px"}});</script>`;
}

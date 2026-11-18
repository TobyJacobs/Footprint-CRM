"use server";

import { redirect } from "next/navigation";
import { brandedHtml, sendEmail } from "@/lib/email/sendgrid";
import { getPortalSession } from "@/lib/portal";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const SAFE = [/^Please /, /^Too many requests$/, /^Not allowed$/];

// Order again from the portal (owner, 18 November 2026): a draft quote for the
// team to check and send, at today's prices (worked out by the database).
export async function submitReorder(token: string, fd: FormData) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const back = `/portal/orders/again/${token}`;
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);
  if (!/^[0-9a-f-]{36}$/i.test(token)) redirect("/portal/orders");
  const key = process.env.PORTAL_LINK_KEY;
  if (!key) fail("This isn't available right now. Please send us a message instead.");
  let items: unknown;
  try {
    items = JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {
    items = [];
  }
  const clean = (Array.isArray(items) ? items : [])
    .filter((i): i is { id: string; quantity: number } => typeof i?.id === "string" && /^[0-9a-f-]{36}$/i.test(i.id))
    .map((i) => ({ id: i.id, quantity: Math.max(0, Math.min(1000000, Number(i.quantity) || 0)) }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_reorder", { p_key: key, p_session: session, p_token: token, p_items: clean, p_note: String(fd.get("note") ?? "").slice(0, 2000) });
  if (error) {
    const msg = error.message.replace(/^.*?ERROR:\s*/, "");
    fail(SAFE.some((r) => r.test(msg)) ? msg : "Sorry, something went wrong. Please try again or send us a message.");
  }
  const r = data as { quote_id: string; number: string; customer: string; from: string; email: string; first_name: string | null; total: number; notify: string[] };
  const link = `${await siteUrl()}/sales/${r.quote_id}`;
  for (const to of r.notify ?? []) {
    const text = `${r.customer} (${r.email}) has asked to order again from their portal, based on ${r.from}.\n\nGuide total: ${money.format(Number(r.total))} including VAT.\n\nIt's saved as draft quote ${r.number}. Please check the items, prices and artwork, then send it to them within one working day.`;
    await sendEmail({ to, subject: `Order again request: ${r.customer}`, text: `${text}\n\n${link}`, html: brandedHtml({ text, buttonLabel: `Open quote ${r.number}`, buttonUrl: link, companyName: "Footprint Group" }), replyTo: r.email, tag: "portal-reorder" });
  }
  const thanks = `Hi ${r.first_name || "there"},\n\nThank you for your order request (based on your order ${r.from}). We'll check it and send you the quote within one working day; it will appear in your portal under Quotes for you to accept.\n\nFootprint Group`;
  await sendEmail({ to: r.email, subject: "We've received your order request", text: thanks, html: brandedHtml({ text: thanks, companyName: "Footprint Group" }), tag: "portal-reorder-received" });
  redirect("/portal/orders?requested=1");
}

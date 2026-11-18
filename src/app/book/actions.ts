"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { brandedHtml, sendEmail } from "@/lib/email/sendgrid";
import { checkStamp } from "@/lib/lead-forms";
import { BOOKING_STAMP_ID, monthName, planBooking, type BookingSetup } from "@/lib/online-booking";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

// Messages the public may see (anything else becomes a general one).
const SAFE = [/^Please /, /^Sorry, /, /^Too many requests$/, /^Online booking is closed$/];

// Send an online advert booking request (owner, 18 November 2026). Prices
// and availability are worked out again here from the database, never taken
// from the browser; the database checks the space once more and makes a
// draft advertising quote for the team to confirm.
export async function submitBooking(embed: boolean, fd: FormData) {
  const back = `/book${embed ? "?embed=1" : "?"}`;
  const fail = (m: string): never => redirect(`${back}&error=${encodeURIComponent(m)}`);
  // Spam: the hidden trap or a form sent too fast is quietly "thanked".
  if (String(fd.get("website") ?? "")) redirect(`${back}&sent=1`);
  const stamp = checkStamp(BOOKING_STAMP_ID, String(fd.get("t") ?? ""));
  if (stamp === "too-fast") redirect(`${back}&sent=1`);
  if (stamp === "stale") fail("This page timed out. Please check your choices and send it again.");

  const key = process.env.PORTAL_LINK_KEY;
  if (!key) fail("Online booking isn't available right now. Please call us on 01329 288822.");
  const supabase = await createClient();
  const { data: setupData } = await supabase.rpc("online_booking_setup", { p_key: key });
  const setup = setupData as BookingSetup | null;
  if (!setup) fail("Online booking isn't available right now. Please call us on 01329 288822.");

  const choice = {
    editionIds: String(fd.get("editions") ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)),
    optionKey: String(fd.get("option") ?? ""),
    months: Number(fd.get("months")) || 0,
    start: String(fd.get("start") ?? ""),
  };
  if (!/^\d{4}-\d{2}$/.test(choice.start) || ![1, 3, 6, 12].includes(choice.months)) fail("Please choose your months and start month");
  const plan = planBooking(setup!, choice);
  if (!plan.ok) fail("Please choose editions and an advert that are available");

  const h = await headers();
  const ip = h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = createHash("sha256").update(`${key}:${ip}`).digest("hex");
  const s = (n: string, max: number) => String(fd.get(n) ?? "").trim().slice(0, max);
  const booking = {
    company: s("company", 200),
    name: s("name", 200),
    email: s("email", 254),
    phone: s("phone", 50),
    street: s("street", 200),
    city: s("city", 100),
    postcode: s("postcode", 12),
    artwork: s("artwork", 60),
    message: [s("message", 1800), s("page", 300) ? `(Sent from ${s("page", 300)})` : ""].filter(Boolean).join("\n"),
    lines: plan.lines,
  };
  const { data, error } = await supabase.rpc("submit_online_booking", { p_key: key, p_booking: booking, p_ip_hash: ipHash });
  if (error) {
    const msg = error.message.replace(/^.*?ERROR:\s*/, "");
    fail(SAFE.some((r) => r.test(msg)) ? msg : "Sorry, something went wrong. Please try again or call us on 01329 288822.");
  }
  const r = data as { quote_id: string; number: string; customer: string; new_customer: boolean; total: number; notify: string[] };

  // Tell the team, and thank the customer.
  const summary = [
    `${plan.option!.label}, ${plan.months.length} month${plan.months.length === 1 ? "" : "s"} from ${monthName(choice.start)}`,
    `Editions: ${plan.editions.map((e) => e.name).join(", ")}`,
    `Price: ${money.format(plan.total)} before VAT (${money.format(plan.perMonth)} a month)`,
  ].join("\n");
  const link = `${await siteUrl()}/sales/${r.quote_id}`;
  for (const to of r.notify ?? []) {
    const text = `New online advert booking request from ${booking.company} (${booking.name}, ${booking.email}, ${booking.phone}).\n\n${summary}\n\nArtwork: ${booking.artwork}${booking.message ? `\n\nMessage: ${booking.message}` : ""}\n\nIt's saved as draft quote ${r.number}${r.new_customer ? " (new customer)" : ""}. Please check it and send it to them within one working day.`;
    await sendEmail({ to, subject: `Online advert booking: ${booking.company}`, text: `${text}\n\n${link}`, html: brandedHtml({ text, buttonLabel: `Open quote ${r.number}`, buttonUrl: link, companyName: "Forget Me Not" }), replyTo: booking.email, tag: "online-booking" });
  }
  const thanks = `Hi ${booking.name.split(" ")[0]},\n\nThank you for your advertising request. We've received:\n\n${summary}\n\nWe'll check availability and confirm your space and final price by email within one working day. Nothing is payable until then.\n\nForget Me Not`;
  await sendEmail({ to: booking.email, subject: "We've received your advertising request", text: thanks, html: brandedHtml({ text: thanks, companyName: "Forget Me Not" }), tag: "online-booking-received" });
  redirect(`${back}&sent=1`);
}

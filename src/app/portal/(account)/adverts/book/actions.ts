"use server";

import { redirect } from "next/navigation";
import { brandedHtml, sendEmail } from "@/lib/email/sendgrid";
import { monthName, planBooking, type BookingSetup } from "@/lib/online-booking";
import { getPortalSession } from "@/lib/portal";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const SAFE = [/^Please /, /^Sorry, /, /^Too many requests$/, /^Online booking is closed$/, /^Not allowed$/];

// Book more adverts from the portal (owner, 18 November 2026). Prices and
// availability are worked out again here; the database checks the person is
// signed in, the company is theirs and the space is free, then makes a draft
// advertising quote for the team to confirm.
export async function submitPortalBooking(fd: FormData) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const back = "/portal/adverts/book";
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);
  const key = process.env.PORTAL_LINK_KEY;
  if (!key) fail("Booking isn't available right now. Please send us a message instead.");
  const supabase = await createClient();
  const setup = (await supabase.rpc("online_booking_setup", { p_key: key })).data as BookingSetup | null;
  if (!setup) fail("Booking isn't available right now. Please send us a message instead.");

  const choice = {
    editionIds: String(fd.get("editions") ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)),
    optionKey: String(fd.get("option") ?? ""),
    months: Number(fd.get("months")) || 0,
    start: String(fd.get("start") ?? ""),
  };
  if (!/^\d{4}-\d{2}$/.test(choice.start) || ![1, 3, 6, 12].includes(choice.months)) fail("Please choose your months and start month");
  const plan = planBooking(setup!, choice);
  if (!plan.ok) fail("Please choose editions and an advert that are available");
  const customerId = String(fd.get("customer_id") ?? "");
  const booking = {
    artwork: String(fd.get("artwork") ?? "").slice(0, 60),
    message: String(fd.get("message") ?? "").trim().slice(0, 2000),
    lines: plan.lines,
  };
  const { data, error } = await supabase.rpc("submit_portal_booking", { p_key: key, p_session: session, p_customer_id: customerId, p_booking: booking });
  if (error) {
    const msg = error.message.replace(/^.*?ERROR:\s*/, "");
    fail(SAFE.some((r) => r.test(msg)) ? msg : "Sorry, something went wrong. Please try again or send us a message.");
  }
  const r = data as { quote_id: string; number: string; customer: string; notify: string[]; email: string; first_name: string | null };

  const summary = [
    `${plan.option!.label}, ${plan.months.length} month${plan.months.length === 1 ? "" : "s"} from ${monthName(choice.start)}`,
    `Editions: ${plan.editions.map((e) => e.name).join(", ")}`,
    `Price: ${money.format(plan.total)} before VAT (${money.format(plan.perMonth)} a month)`,
  ].join("\n");
  const link = `${await siteUrl()}/sales/${r.quote_id}`;
  for (const to of r.notify ?? []) {
    const text = `${r.customer} (${r.email}) has asked for more adverts from their portal.\n\n${summary}\n\nArtwork: ${booking.artwork}${booking.message ? `\n\nMessage: ${booking.message}` : ""}\n\nIt's saved as draft quote ${r.number}. Please check it and send it to them within one working day.`;
    await sendEmail({ to, subject: `Portal advert booking: ${r.customer}`, text: `${text}\n\n${link}`, html: brandedHtml({ text, buttonLabel: `Open quote ${r.number}`, buttonUrl: link, companyName: "Forget Me Not" }), replyTo: r.email, tag: "portal-booking" });
  }
  const thanks = `Hi ${r.first_name || "there"},\n\nThank you for your advertising request. We've received:\n\n${summary}\n\nWe'll check availability and confirm your space and final price within one working day; the quote will then appear in your portal under Quotes for you to accept. Nothing is payable until then.\n\nForget Me Not`;
  await sendEmail({ to: r.email, subject: "We've received your advertising request", text: thanks, html: brandedHtml({ text: thanks, companyName: "Forget Me Not" }), tag: "online-booking-received" });
  redirect("/portal/adverts?requested=1");
}

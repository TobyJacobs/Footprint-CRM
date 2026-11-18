"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { brandedHtml, isEmailConfigured, isEmailTestMode, sendEmail } from "@/lib/email/sendgrid";
import { loadCopyRecipients } from "@/lib/magazine-copies";
import { monthLabel } from "@/lib/magazines";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

// Email each advertiser in an issue a link to read it online and the page
// their advert is on (owner, 16 November 2026). Only advertisers not emailed
// already, and only once the flipbook is published.
export async function emailAdvertiserCopies(issueId: string) {
  await requirePermission("magazines", "edit");
  const back = `/reports/production?issue=${issueId}`;
  const fail = (m: string): never => redirect(`${back}&error=${encodeURIComponent(m)}`);
  if (!/^[0-9a-f-]{36}$/i.test(issueId)) fail("Unknown issue");
  if (!isEmailConfigured()) fail("Email isn't switched on yet");

  const supabase = await createClient();
  const [{ data: issue }, { data: settings }] = await Promise.all([
    supabase.from("magazine_issues").select("id, month, flipbook_published_at, magazine_editions(name, slug)").eq("id", issueId).maybeSingle(),
    supabase.from("company_settings").select("company_name").single(),
  ]);
  if (!issue) fail("Unknown issue");
  const edition = issue!.magazine_editions as unknown as { name: string; slug: string };
  if (!issue!.flipbook_published_at) fail("Publish this issue's flipbook first (on the flatplan)");

  const link = `${await siteUrl()}/read/${edition.slug}/${String(issue!.month).slice(0, 7)}`;
  const company = settings?.company_name ?? "Footprint Group";
  const issueName = `${edition.name}, ${monthLabel(issue!.month)}`;
  const todo = (await loadCopyRecipients(supabase, issueId)).filter((r) => r.email && !r.sentAt);
  if (!todo.length) fail("Every advertiser with an email address has already been sent this issue");

  let sentCount = 0;
  let failed = 0;
  for (const r of todo) {
    const where = r.pages.length ? `Your advert is on page${r.pages.length > 1 ? "s" : ""} ${r.pages.join(", ")}.` : "";
    const subject = `Your copy of ${issueName}`;
    const text = [
      `Hi ${r.firstName || "there"},`,
      `The ${issueName} issue is out, and you can read it online now. ${where}`.trim(),
      `Thank you for advertising with us.`,
      `Kind regards,\n${r.ownerName || company}\n${company}`,
    ].join("\n\n");
    const html = brandedHtml({ text, buttonLabel: "Read this issue", buttonUrl: link, companyName: company });
    const result = await sendEmail({ to: r.email!, subject, text: `${text}\n\nRead it here: ${link}`, html, replyTo: r.ownerEmail, tag: "magazine-copy" });
    const status = result.ok ? (isEmailTestMode() ? "test" : "sent") : "failed";
    if (result.ok) sentCount++;
    else failed++;
    await supabase.from("magazine_copy_emails").insert({ issue_id: issueId, customer_id: r.customerId, to_address: r.email!, status, error: result.ok ? null : result.error.slice(0, 1000) });
    await supabase.from("email_log").insert({
      sales_document_id: r.orderId,
      customer_id: r.customerId,
      to_addresses: r.email!,
      subject,
      body: text,
      status,
      provider_message_id: result.ok ? result.messageId : null,
      error: result.ok ? null : result.error,
    });
  }
  revalidatePath("/reports/production");
  redirect(`${back}&copies=${sentCount}${failed ? `&copyfailed=${failed}` : ""}`);
}

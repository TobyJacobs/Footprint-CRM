"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { gbp, longDate } from "@/lib/customers/display";
import { brandedHtml, isEmailTestMode, sendEmail } from "@/lib/email/postmark";
import { str } from "@/lib/forms";
import { getPurchaseOrderLines } from "@/lib/sales/data";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function addressList(value: string | null): string[] | null {
  if (!value) return [];
  const list = value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  return list.every((a) => EMAIL_RE.test(a)) ? list : null;
}

// Place an order with a supplier: emails the purchase order (with its lines in
// the email itself) and marks a draft PO as "sent to supplier".
export async function sendPurchaseOrderEmail(poId: string, fd: FormData) {
  await requirePermission("quotes", "edit");
  const back = `/sales/purchase-orders/${poId}`;
  const supabase = await createClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, number, status, customer_id, expected_date, deliver_to, subtotal, vat_total, total")
    .eq("id", poId)
    .single();
  if (!po) fail(back, "Purchase order not found");
  if (["cancelled", "closed"].includes(po.status)) fail(back, "This purchase order is finished");

  const to = addressList(str(fd, "to"));
  const cc = addressList(str(fd, "cc"));
  const subject = str(fd, "subject");
  const message = str(fd, "message");
  if (!to || to.length === 0) fail(back, "Please enter the supplier's email address");
  if (cc === null) fail(back, "One of the CC addresses doesn't look right");
  if (!subject || !message) fail(back, "Please add a subject and a message");

  const lines = await getPurchaseOrderLines(poId);
  const { data: settings } = await supabase.from("company_settings").select("company_name").single();
  const company = settings?.company_name ?? "Footprint Group";
  const money = (n: number) => gbp(n) ?? "";

  const details = [
    `Purchase order: ${po.number}`,
    po.expected_date ? `Needed by: ${longDate(po.expected_date)}` : null,
    po.deliver_to ? `Deliver to: ${po.deliver_to}` : null,
  ].filter(Boolean).join("\n");
  const fullMessage = `${message}\n\n${details}`;
  const linesText = lines
    .map((l) => `- ${l.description.replace(/\n/g, " ")} × ${l.quantity} @ ${money(l.unit_cost)} = ${money(l.line_net)}`)
    .join("\n");
  const text = `${fullMessage}\n\nOrder details\n${linesText}\nSubtotal ${money(Number(po.subtotal))} · VAT ${money(Number(po.vat_total))} · Total ${money(Number(po.total))}`;

  const result = await sendEmail({
    to: to.join(", "),
    cc: cc.length ? cc.join(", ") : null,
    subject,
    text,
    html: brandedHtml({
      text: fullMessage,
      companyName: company,
      table: {
        head: ["Item", "Qty", "Unit cost", "Net"],
        rows: lines.map((l) => [l.description, String(l.quantity), money(l.unit_cost), money(l.line_net)]),
        foot: [
          ["Subtotal", "", "", money(Number(po.subtotal))],
          ["VAT", "", "", money(Number(po.vat_total))],
          ["Total", "", "", money(Number(po.total))],
        ],
      },
    }),
    tag: "purchase_order",
  });

  const status = result.ok ? (isEmailTestMode() ? "test" : "sent") : "failed";
  await supabase.from("email_log").insert({
    purchase_order_id: poId,
    customer_id: po.customer_id,
    to_addresses: to.join(", "),
    cc_addresses: cc.length ? cc.join(", ") : null,
    subject,
    body: text,
    status,
    provider_message_id: result.ok ? result.messageId : null,
    error: result.ok ? null : result.error,
  });
  if (!result.ok) fail(back, `The email wasn't sent: ${result.error}`);

  if (po.status === "draft") {
    await supabase.from("purchase_orders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", poId);
  }

  revalidatePath("/sales", "layout");
  redirect(`${back}?emailed=${status}`);
}

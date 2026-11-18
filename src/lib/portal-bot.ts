import "server-only";
import { ukToday } from "@/lib/dates";
import { advertArtworkLabel, orderProgressLabel, quoteWaiting, ticketNumber, ticketStatusLabel, type PortalOverview } from "@/lib/portal";

// What the portal assistant knows about the signed-in customer: a short,
// plain list built from their own portal records (the same things the portal
// shows them). No links, codes or anything about other customers.

const money = (n: number | null | undefined) => `£${Number(n ?? 0).toFixed(2)}`;
const MAX_EACH = 15;

function section(title: string, lines: string[]) {
  if (lines.length === 0) return `${title}: none.`;
  const shown = lines.slice(0, MAX_EACH);
  const more = lines.length > shown.length ? `\n  (and ${lines.length - shown.length} older ones not listed)` : "";
  return `${title}:\n${shown.map((l) => `  - ${l}`).join("\n")}${more}`;
}

const designStage: Record<string, string> = {
  with_customer: "proof waiting for their approval",
  amends: "making their changes",
  approved: "artwork approved",
  production: "in production",
  done: "finished",
};

export function accountSummary(p: PortalOverview): string {
  const multi = p.customers.length > 1;
  const who = (name: string) => (multi ? ` (${name})` : "");
  const newestFirst = <T,>(rows: T[], date: (r: T) => string | null | undefined) =>
    [...rows].sort((a, b) => (date(b) ?? "").localeCompare(date(a) ?? ""));

  const parts = [
    `Today is ${ukToday()}. Customer: ${p.first_name ?? p.email}, of ${p.customers.map((c) => c.name).join(", ") || "no company"}.`,
    section(
      "Quotes",
      newestFirst(p.quotes, (q) => q.issue_date).map(
        (q) =>
          `${q.number}${q.title ? ` "${q.title}"` : ""}${who(q.customer_name)}: ${money(q.total)}, sent ${q.issue_date}, ${
            quoteWaiting(q) ? `waiting for their answer${q.valid_until ? ` (valid until ${q.valid_until})` : ""}` : q.status
          }`,
      ),
    ),
    section(
      "Orders",
      newestFirst(p.orders, (o) => o.issue_date).map(
        (o) =>
          `${o.number}${o.title ? ` "${o.title}"` : ""}${o.po ? ` (their PO ${o.po})` : ""}${who(o.customer_name)}: ${money(o.total)}, ordered ${o.issue_date}, ${orderProgressLabel(o).label}${
            o.shipped_at ? ` (shipped ${o.shipped_at.slice(0, 10)})` : ""
          }`,
      ),
    ),
    section(
      "Design work",
      newestFirst(p.artwork, (a) => a.stage_changed_at).map(
        (a) =>
          `"${a.title}"${a.order_number ? ` for order ${a.order_number}` : ""}${a.is_advert ? " (magazine advert)" : ""}${who(a.customer_name)}: ${
            designStage[a.stage] ?? (a.artwork_source === "customer" ? "checking their artwork" : "being designed")
          }${a.proofs?.length ? `, ${a.proofs.length} proof${a.proofs.length > 1 ? "s" : ""} sent` : ""}`,
      ),
    ),
    section(
      "Magazine adverts",
      newestFirst(p.adverts, (a) => a.month).map(
        (a) => `${a.edition}, ${a.month}${a.size ? `, ${a.size}` : ""} (order ${a.order_number})${who(a.customer_name)}: ${advertArtworkLabel(a.artwork_stage, a.artwork_source)}`,
      ),
    ),
    section(
      "Invoices",
      newestFirst(p.invoices, (v) => v.issue_date).map(
        (v) =>
          `${v.number}${v.title ? ` "${v.title}"` : ""}${who(v.customer_name)}: ${money(v.total)}, dated ${v.issue_date}${
            Number(v.owed) > 0 ? `, ${money(v.owed)} still to pay${v.due_date ? `, due ${v.due_date}` : ""}` : ", paid"
          }`,
      ),
    ),
    section(
      "Hosting",
      p.hosting.map(
        (h) =>
          `${h.name}${who(h.customer_name)}: ${h.status ?? "active"}${h.price != null ? `, ${money(h.price)}${h.billing_frequency ? ` ${h.billing_frequency}` : ""}` : ""}${
            h.renewal_month ? `, renews ${h.renewal_month}` : ""
          }${h.items.length ? ` (${h.items.map((i) => [i.kind === "web" ? "website" : "email", i.domain, i.plan].filter(Boolean).join(" ")).join("; ")})` : ""}`,
      ),
    ),
    section(
      "Marketing content",
      p.content.map((c) => `"${c.title}" on ${c.channel}${who(c.customer_name)}: ${c.status === "client_approval" ? "waiting for their approval" : c.status}${c.publish_date ? `, ${c.publish_date}` : ""}`),
    ),
    section(
      "Ad campaigns",
      p.campaigns.map(
        (c) => `${c.name} on ${c.platform}${who(c.customer_name)}: ${c.status}${c.start_date ? `, from ${c.start_date}` : ""}${c.end_date ? ` to ${c.end_date}` : ""}${c.leads != null ? `, ${c.leads} leads` : ""}`,
      ),
    ),
    section(
      "Support conversations",
      newestFirst(p.tickets, (t) => t.last_message_at).map((t) => `${ticketNumber(t.number)} "${t.subject}"${who(t.customer_name)}: ${ticketStatusLabel(t.status)}`),
    ),
  ];
  return parts.join("\n\n").slice(0, 14000);
}

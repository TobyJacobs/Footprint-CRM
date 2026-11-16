import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { gbp, longDate } from "@/lib/customers/display";
import { ukToday } from "@/lib/dates";
import { getPortal, orderProgressLabel, portalAttention } from "@/lib/portal";
import { PortalPage } from "./parts";

export const metadata: Metadata = { title: "Your portal" };

// The signed-in customer's home: what's waiting for them, a few totals and
// their latest orders. Each section has its own page in the side menu.
export default async function PortalHomePage() {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const waiting = portalAttention(portal);
  const owed = waiting.invoices.reduce((sum, v) => sum + Number(v.owed), 0);
  const overdue = waiting.invoices.some((v) => v.due_date && v.due_date < ukToday());

  const todo = [
    ...waiting.proofs.map((a) => ({ key: `p${a.number}`, href: `/p/${a.proof_token}`, text: `Approve the proof for ${a.title}`, tag: "Design" })),
    ...waiting.quotes.map((q) => ({ key: `q${q.token}`, href: `/q/${q.token}`, text: `Reply to quote ${q.number}${q.title ? `: ${q.title}` : ""}`, tag: "Quote" })),
    ...waiting.content.map((c, i) => ({ key: `c${i}`, href: "/portal/marketing", text: `Approve "${c.title}" (${c.channel})`, tag: "Marketing" })),
    ...(owed > 0 ? [{ key: "pay", href: "/portal/invoices", text: `${overdue ? "Overdue: pay" : "Pay"} ${gbp(owed)} on ${waiting.invoices.length} invoice${waiting.invoices.length === 1 ? "" : "s"}`, tag: "Invoices" }] : []),
  ];

  const openOrders = portal.orders.filter((o) => o.status === "open");
  const activeDesign = portal.artwork.filter((a) => a.stage !== "done");
  const openTickets = portal.tickets.filter((t) => t.status !== "done");
  const tiles = [
    { href: "/portal/orders", label: "Orders in progress", value: String(openOrders.length) },
    { href: "/portal/design", label: "Design jobs under way", value: String(activeDesign.length) },
    { href: "/portal/invoices", label: "Still to pay", value: gbp(owed) },
    { href: "/portal/support", label: "Open support messages", value: String(openTickets.length) },
  ];

  return (
    <PortalPage
      title={`Hello${portal.first_name ? ` ${portal.first_name}` : ""}`}
      intro={`Your account with Footprint Group${portal.customers.length ? ` for ${portal.customers.map((c) => c.name).join(", ")}` : ""}.`}
    >
      <Card title="Needs your attention">
        {todo.length === 0 ? (
          <p className="text-sm text-fp-mid">Nothing needs you right now. We&apos;ll email you when it does.</p>
        ) : (
          <ul className="divide-y divide-fp-border text-sm">
            {todo.map((t) => (
              <li key={t.key}>
                <Link href={t.href} className="flex items-center justify-between gap-3 py-3 font-semibold hover:text-fp-pink">
                  <span className="flex items-center gap-3">
                    <Badge tone="pink">{t.tag}</Badge>
                    {t.text}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-fp-mid" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-lg border border-fp-border bg-white p-4 transition-colors hover:border-fp-pink">
            <p className="text-xs font-bold uppercase tracking-wide text-fp-mid">{t.label}</p>
            <p className="mt-1 text-2xl font-black">{t.value}</p>
          </Link>
        ))}
      </div>

      <Card
        title="Latest orders"
        action={
          <Link href="/portal/orders" className="text-sm font-semibold text-fp-teal-deep hover:underline">
            All orders
          </Link>
        }
      >
        {portal.orders.length === 0 ? (
          <p className="text-sm text-fp-mid">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-fp-border text-sm">
            {portal.orders.slice(0, 5).map((o) => {
              const progress = orderProgressLabel(o);
              return (
                <li key={o.token} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {o.number}
                      {o.title ? ` · ${o.title}` : ""}
                    </p>
                    <p className="text-xs text-fp-mid">
                      {o.po ? `Your PO ${o.po} · ` : ""}
                      {longDate(o.issue_date)}
                    </p>
                  </div>
                  <Badge tone={progress.tone}>{progress.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PortalPage>
  );
}

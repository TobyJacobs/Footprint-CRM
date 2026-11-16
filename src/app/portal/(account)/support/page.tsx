import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Badge, primaryButton } from "@/components/ui";
import { shortDateTime } from "@/lib/customers/display";
import { getPortal, ticketKindLabel, ticketNumber, ticketStatusLabel, ticketTone } from "@/lib/portal";
import { PortalPage } from "../parts";

export const metadata: Metadata = { title: "Support" };

export default async function PortalSupportPage() {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const several = portal.customers.length > 1;

  return (
    <PortalPage
      title="Support"
      intro="Ask for a change or ask us a question. We'll reply here and email you when we do."
      action={
        <Link href="/portal/support/new" className={primaryButton}>
          Send us a message
        </Link>
      }
    >
      <Card>
        {portal.tickets.length === 0 ? (
          <p className="text-sm text-fp-mid">No messages yet.</p>
        ) : (
          <ul className="divide-y divide-fp-border text-sm">
            {portal.tickets.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <Link href={`/portal/support/${t.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                    {t.subject}
                  </Link>
                  <p className="text-xs text-fp-mid">
                    {ticketNumber(t.number)} · {ticketKindLabel(t.kind)} · last message {shortDateTime(t.last_message_at)}
                    {several ? ` · ${t.customer_name}` : ""}
                  </p>
                </div>
                <Badge tone={ticketTone(t.status)}>{ticketStatusLabel(t.status)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PortalPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Badge, secondaryButton } from "@/components/ui";
import { gbp, longDate } from "@/lib/customers/display";
import { getPortal } from "@/lib/portal";
import { quoteKindLabel } from "@/lib/sales/options";
import { PortalPage, quoteStatus } from "../parts";

export const metadata: Metadata = { title: "Your quotes" };

export default async function PortalQuotesPage() {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const several = portal.customers.length > 1;

  return (
    <PortalPage
      title="Your quotes"
      intro="Every quote we've sent you. Open one to read it, then accept or decline it."
    >
      <Card>
        {portal.quotes.length === 0 ? (
          <p className="text-sm text-fp-mid">No quotes yet.</p>
        ) : (
          <ul className="divide-y divide-fp-border text-sm">
            {portal.quotes.map((q) => {
              const status = quoteStatus(q);
              return (
                <li key={q.token} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {q.number}
                      {q.title ? ` · ${q.title}` : ""}
                    </p>
                    <p className="text-xs text-fp-mid">
                      {quoteKindLabel(q.kind)} · {longDate(q.issue_date)}
                      {several ? ` · ${q.customer_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{gbp(q.total)}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <Link href={`/q/${q.token}`} className={secondaryButton}>
                      {status.label === "Waiting for your reply" ? "View and reply" : "View"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PortalPage>
  );
}

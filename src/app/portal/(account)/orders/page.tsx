import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Badge, secondaryButton } from "@/components/ui";
import { gbp, longDate } from "@/lib/customers/display";
import { getPortal, orderProgressLabel } from "@/lib/portal";
import { PortalPage } from "../parts";

export const metadata: Metadata = { title: "Your orders" };

export default async function PortalOrdersPage() {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const several = portal.customers.length > 1;

  return (
    <PortalPage
      title="Your orders"
      intro="Your orders with us, with your own purchase order (PO) numbers and how each one is getting on."
    >
      <Card>
        {portal.orders.length === 0 ? (
          <p className="text-sm text-fp-mid">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-fp-border text-sm">
            {portal.orders.map((o) => {
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
                      {o.shipped_at ? ` · shipped ${longDate(o.shipped_at.slice(0, 10))}` : ""}
                      {several ? ` · ${o.customer_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{gbp(Number(o.total))}</span>
                    <Badge tone={progress.tone}>{progress.label}</Badge>
                    <Link href={`/d/${o.token}`} className={secondaryButton}>
                      View
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

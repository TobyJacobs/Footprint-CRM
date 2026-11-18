import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Badge, secondaryButton } from "@/components/ui";
import { gbp, longDate } from "@/lib/customers/display";
import { getPortal, orderProgressLabel } from "@/lib/portal";
import { PortalPage } from "../parts";

export const metadata: Metadata = { title: "Your orders" };

export default async function PortalOrdersPage(props: PageProps<"/portal/orders">) {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const several = portal.customers.length > 1;
  const sp = await props.searchParams;

  return (
    <PortalPage
      title="Your orders"
      intro="Your orders with us, with your own purchase order (PO) numbers and how each one is getting on."
    >
      {sp.requested === "1" && (
        <p role="status" className="mb-4 rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
          Thank you, we&apos;ve received your order request. We&apos;ll check it and send you the quote within one working day; it will appear under Quotes
          for you to accept.
        </p>
      )}
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
                    {/* Order again (owner, 18 November 2026). */}
                    <Link href={`/portal/orders/again/${o.token}`} className={secondaryButton}>
                      Order again
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

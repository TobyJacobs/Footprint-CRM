import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, Badge } from "@/components/ui";
import { gbp } from "@/lib/customers/display";
import { getPortal } from "@/lib/portal";
import { PortalPage } from "../parts";

export const metadata: Metadata = { title: "Your hosting" };

export default async function PortalHostingPage() {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const several = portal.customers.length > 1;

  return (
    <PortalPage
      title="Your hosting"
      intro="Your websites and email hosting with us."
    >
      <Card>
        {portal.hosting.length === 0 ? (
          <p className="text-sm text-fp-mid">No hosting plans with us.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {portal.hosting.map((h, i) => (
              <div key={`${h.name}-${i}`} className="rounded-md border border-fp-border p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{h.name}</p>
                  {h.status && <Badge tone={/active|live/i.test(h.status) ? "teal" : "grey"}>{h.status}</Badge>}
                </div>
                {several && <p className="text-xs text-fp-mid">{h.customer_name}</p>}
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  {h.plan_type && (
                    <>
                      <dt className="text-fp-mid">Plan</dt>
                      <dd>{h.plan_type}</dd>
                    </>
                  )}
                  {h.price !== null && (
                    <>
                      <dt className="text-fp-mid">Price</dt>
                      <dd>
                        {gbp(h.price)}
                        {h.billing_frequency ? ` · ${h.billing_frequency}` : ""}
                      </dd>
                    </>
                  )}
                  {h.renewal_month && (
                    <>
                      <dt className="text-fp-mid">Renews</dt>
                      <dd>{h.renewal_month}</dd>
                    </>
                  )}
                </dl>
                {h.items.length > 0 && (
                  <ul className="mt-3 grid gap-1 border-t border-fp-border pt-3">
                    {h.items.map((it, j) => (
                      <li key={j}>
                        {it.kind === "web" ? (
                          <>
                            <strong>Website:</strong> {it.domain ?? "—"}
                            {it.plan ? ` (${it.plan})` : ""}
                          </>
                        ) : (
                          <>
                            <strong>Email:</strong> {it.mailbox_qty ?? "?"} mailbox{it.mailbox_qty === 1 ? "" : "es"}
                            {it.email_platform ? ` on ${it.email_platform}` : ""}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </PortalPage>
  );
}

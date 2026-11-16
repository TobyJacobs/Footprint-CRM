import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, Badge } from "@/components/ui";
import { gbp, longDate } from "@/lib/customers/display";
import { getPortal } from "@/lib/portal";
import { PortalPage, contentLabel, contentTone, campaignLabel, campaignTone } from "../parts";

export const metadata: Metadata = { title: "Your marketing" };

export default async function PortalMarketingPage() {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const several = portal.customers.length > 1;

  return (
    <PortalPage
      title="Your marketing"
      intro="Your retainers, ad campaigns and content calendar."
    >
      <Card>
        {portal.content.length + portal.campaigns.length + portal.retainers.length === 0 ? (
          <p className="text-sm text-fp-mid">No marketing work with us yet.</p>
        ) : (
          <div className="grid gap-6 text-sm">
            {portal.retainers.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">Retainers</h3>
                <ul className="grid gap-2 md:grid-cols-2">
                  {portal.retainers.map((r, i) => (
                    <li key={i} className="rounded-md border border-fp-border p-3">
                      <p className="flex items-start justify-between gap-2 font-bold">
                        {r.name}
                        {r.status && <Badge tone={/active|live/i.test(r.status) ? "teal" : "grey"}>{r.status}</Badge>}
                      </p>
                      <p className="text-fp-dark/75">
                        {[r.monthly_fee !== null ? `${gbp(r.monthly_fee)} a month` : null, r.budget_hours ? `${r.budget_hours} hours` : null, several ? r.customer_name : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {portal.campaigns.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">Ad campaigns</h3>
                <ul className="grid gap-2">
                  {portal.campaigns.map((c, i) => (
                    <li key={i} className="rounded-md border border-fp-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-bold">
                          {c.name} <span className="font-normal text-fp-mid">· {c.platform}</span>
                        </p>
                        <Badge tone={campaignTone[c.status]}>{campaignLabel[c.status]}</Badge>
                      </div>
                      <p className="mt-1 text-fp-dark/75">
                        {[
                          c.start_date ? `${longDate(c.start_date)}${c.end_date ? ` to ${longDate(c.end_date)}` : ""}` : null,
                          c.budget !== null ? `Spent ${gbp(c.spend)} of ${gbp(c.budget)}` : c.spend ? `Spent ${gbp(c.spend)}` : null,
                          c.leads !== null ? `${c.leads} lead${c.leads === 1 ? "" : "s"}` : null,
                          several ? c.customer_name : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {c.budget !== null && c.budget > 0 && (
                        <div className="mt-2 h-2 rounded-full bg-fp-light" aria-hidden>
                          <div className="h-2 rounded-full bg-fp-teal-deep" style={{ width: `${Math.min(100, (c.spend / c.budget) * 100)}%` }} />
                        </div>
                      )}
                      {c.results && <p className="mt-2 whitespace-pre-wrap">{c.results}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {portal.content.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">Content calendar</h3>
                <ul className="divide-y divide-fp-border">
                  {portal.content.map((c, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {c.link && c.status === "published" ? (
                            <a href={c.link} target="_blank" rel="noopener noreferrer" className="text-fp-teal-deep hover:underline">
                              {c.title}
                            </a>
                          ) : (
                            c.title
                          )}
                        </p>
                        <p className="text-xs text-fp-mid">
                          {c.channel}
                          {c.publish_date ? ` · ${longDate(c.publish_date)}` : ""}
                          {several ? ` · ${c.customer_name}` : ""}
                        </p>
                      </div>
                      <Badge tone={contentTone[c.status]}>{contentLabel[c.status]}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </Card>
    </PortalPage>
  );
}

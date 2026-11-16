import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, Badge } from "@/components/ui";
import { getPortal, advertArtworkLabel } from "@/lib/portal";
import { PortalPage, longMonth } from "../parts";

export const metadata: Metadata = { title: "Your adverts" };

export default async function PortalAdvertsPage() {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const several = portal.customers.length > 1;

  return (
    <PortalPage
      title="Your adverts"
      intro="Your adverts in Forget Me Not, month by month, and how the artwork is getting on."
    >
      <Card>
        {portal.adverts.length === 0 ? (
          <p className="text-sm text-fp-mid">No adverts booked with us.</p>
        ) : (
          <ul className="grid gap-4 text-sm">
            {[...new Set(portal.adverts.map((a) => a.month))].map((m) => (
              <li key={m}>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-fp-mid">{longMonth(m)}</h3>
                <ul className="divide-y divide-fp-border rounded-md border border-fp-border">
                  {portal.adverts
                    .filter((a) => a.month === m)
                    .map((a, i) => {
                      const art = advertArtworkLabel(a.artwork_stage, a.artwork_source);
                      return (
                        <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span>
                            <strong>{a.edition}</strong> · {a.size ?? "Advert"}
                            <span className="text-xs text-fp-mid">
                              {" "}
                              · order {a.order_number}
                              {several ? ` · ${a.customer_name}` : ""}
                            </span>
                          </span>
                          <Badge tone={art === "Artwork approved" ? "teal" : art === "Waiting for your approval" ? "pink" : "grey"}>{art}</Badge>
                        </li>
                      );
                    })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PortalPage>
  );
}

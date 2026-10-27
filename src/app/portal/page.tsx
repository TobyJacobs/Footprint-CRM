import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, secondaryButton } from "@/components/ui";
import { gbp, longDate } from "@/lib/customers/display";
import { ukToday } from "@/lib/dates";
import { getPortal, type PortalQuote } from "@/lib/portal";
import { quoteKindLabel } from "@/lib/sales/options";
import { signOutOfPortal } from "./actions";

export const metadata: Metadata = { title: "Your portal" };

function quoteStatus(q: PortalQuote): { label: string; tone: "grey" | "teal" | "pink" | "amber" | "red" } {
  if (q.status === "accepted" || q.status === "converted") return { label: "Accepted", tone: "teal" };
  if (q.status === "declined") return { label: "Declined", tone: "grey" };
  if (q.valid_until && q.valid_until < ukToday()) return { label: "Expired", tone: "grey" };
  return { label: "Waiting for your reply", tone: "pink" };
}

// The signed-in customer's home: their quotes and hosting plans, and only theirs.
export default async function PortalHomePage() {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const companies = portal.customers.map((c) => c.name);
  const several = companies.length > 1;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Hello{portal.first_name ? ` ${portal.first_name}` : ""}</h1>
          <p className="mt-1 text-sm text-fp-dark/75">
            {companies.join(", ")} · signed in as {portal.email}
          </p>
        </div>
        <form action={signOutOfPortal}>
          <button type="submit" className={secondaryButton}>
            Sign out
          </button>
        </form>
      </div>

      <Card title="Your quotes">
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

      <Card title="Your hosting">
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

      <p className="text-xs text-fp-mid">Questions about anything here? Reply to any email from us, or call the office.</p>
    </div>
  );
}

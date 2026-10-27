import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, primaryButton, secondaryButton } from "@/components/ui";
import { gbp, longDate, shortDateTime } from "@/lib/customers/display";
import { ukToday } from "@/lib/dates";
import {
  getPortal,
  ticketKindLabel,
  ticketNumber,
  ticketStatusLabel,
  ticketTone,
  type PortalCampaign,
  type PortalContent,
  type PortalQuote,
} from "@/lib/portal";
import { quoteKindLabel } from "@/lib/sales/options";
import { signOutOfPortal } from "./actions";

export const metadata: Metadata = { title: "Your portal" };

type Tone = "grey" | "teal" | "pink" | "amber" | "red";
const contentLabel: Record<PortalContent["status"], string> = {
  drafting: "Being written",
  client_approval: "Waiting for your approval",
  scheduled: "Scheduled",
  published: "Published",
};
const contentTone: Record<PortalContent["status"], Tone> = { drafting: "grey", client_approval: "pink", scheduled: "amber", published: "teal" };
const campaignLabel: Record<PortalCampaign["status"], string> = { planned: "Planned", live: "Live", paused: "Paused", ended: "Ended" };
const campaignTone: Record<PortalCampaign["status"], Tone> = { planned: "grey", live: "teal", paused: "amber", ended: "grey" };

function quoteStatus(q: PortalQuote): { label: string; tone: "grey" | "teal" | "pink" | "amber" | "red" } {
  if (q.status === "accepted" || q.status === "converted") return { label: "Accepted", tone: "teal" };
  if (q.status === "declined") return { label: "Declined", tone: "grey" };
  if (q.valid_until && q.valid_until < ukToday()) return { label: "Expired", tone: "grey" };
  return { label: "Waiting for your reply", tone: "pink" };
}

// The signed-in customer's home: their quotes, marketing, hosting plans and
// support messages, and only theirs.
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

      <nav aria-label="Sections" className="flex flex-wrap gap-2 text-sm">
        {[
          ["#quotes", "Quotes"],
          ["#marketing", "Marketing"],
          ["#hosting", "Hosting"],
          ["#support", "Support"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-fp-border bg-white px-3 py-1 font-semibold hover:border-fp-pink">
            {label}
          </a>
        ))}
      </nav>

      <div id="quotes" className="scroll-mt-4">
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
      </div>

      <div id="marketing" className="scroll-mt-4">
        <Card title="Your marketing">
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
      </div>

      <div id="hosting" className="scroll-mt-4">
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
      </div>

      <div id="support" className="scroll-mt-4">
        <Card
          title="Support"
          action={
            <Link href="/portal/support/new" className={primaryButton}>
              Send us a message
            </Link>
          }
        >
          <p className="mb-3 text-sm text-fp-dark/75">Ask for a change or ask us a question. We&apos;ll reply here and email you when we do.</p>
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
      </div>
    </div>
  );
}

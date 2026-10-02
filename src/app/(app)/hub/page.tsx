import type { Metadata } from "next";
import Link from "next/link";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { GoalBar, SimpleList, Tile, money, moneyExact, pacePct } from "@/components/dashboards/parts";
import { getCurrentUser } from "@/lib/auth";
import { longDate } from "@/lib/customers/display";
import {
  commissionFor, describeRule, getCommissionRules, getMonth, getTargets, getTeamStats, grossProfit,
  marginOf, recentMonths, ruleForPerson, sumStats, targetFor, winRate,
} from "@/lib/dashboards/data";
import { docTypes, statusLabel, type DocType } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff hub" };

// Each person's own month: progress against target, commission (with
// history), the group goal, and the work they've done.
export default async function StaffHubPage(props: PageProps<"/hub">) {
  const user = await getCurrentUser();
  if (!user.can("hub", "view")) return <NoAccess title="Staff hub" />;
  const sp = await props.searchParams;
  const month = getMonth(typeof sp.month === "string" ? sp.month : null);
  const history = recentMonths(6);
  const canSeeFigures = user.can("quotes", "view");
  const isSales = user.dashboards.includes("sales") || user.dashboards.includes("director");

  const supabase = await createClient();
  const [targets, rules, monthStats, historyStats, { data: myDocs }] = await Promise.all([
    getTargets(),
    getCommissionRules(),
    canSeeFigures ? getTeamStats(month) : Promise.resolve([]),
    canSeeFigures ? Promise.all(history.map((m) => getTeamStats(m))) : Promise.resolve([]),
    canSeeFigures
      ? supabase
          .from("sales_documents")
          .select("id, doc_type, number, status, total, issue_date, customers!sales_documents_customer_id_fkey(name)")
          .eq("owner_id", user.id)
          .gte("issue_date", month.from)
          .lte("issue_date", month.to)
          .order("issue_date", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
  ]);

  const me = monthStats.find((t) => t.owner_id === user.id) ?? sumStats([]);
  const group = sumStats(monthStats);
  const myTarget = targetFor(targets, "invoiced", user.id, month);
  const groupGoal = targetFor(targets, "invoiced", null, month);
  const rule = ruleForPerson(rules, user.id);
  const commission = commissionFor(me, rule);
  const pace = pacePct(month.dayOfMonth, month.daysInMonth);
  const margin = marginOf(me);

  return (
    <>
      <PageHeader title="Staff hub" intro="Your month at a glance: your progress, your commission and the group's goal." />
      <div className="grid gap-6 px-6 py-8 lg:px-10">
        <nav aria-label="Month" className="flex flex-wrap gap-2 text-sm">
          {history.map((m) => (
            <Link
              key={m.key}
              href={m.key === history[0].key ? "/hub" : `/hub?month=${m.key}`}
              aria-current={m.key === month.key ? "page" : undefined}
              className={`rounded-full border px-3 py-1 font-semibold ${
                m.key === month.key ? "border-fp-pink bg-fp-pink text-white" : "border-fp-border bg-white hover:border-fp-pink"
              }`}
            >
              {m.label}
            </Link>
          ))}
        </nav>

        {!canSeeFigures ? (
          <p className="max-w-xl rounded-lg border border-fp-border bg-white p-5 text-sm text-fp-dark/75">
            Sales figures aren&apos;t switched on for your role yet. Your hub will fill in as more sections arrive.
          </p>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              <GoalBar
                title={`Your sales — ${month.label}`}
                actual={me.invoiced}
                target={myTarget?.amount ?? null}
                pacePct={pace}
                example={myTarget?.is_example}
              />
              <GoalBar
                title={`Group goal — ${month.label}`}
                actual={group.invoiced}
                target={groupGoal?.amount ?? null}
                pacePct={pace}
                example={groupGoal?.is_example}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {isSales && (
                <Tile
                  label="Your commission"
                  value={moneyExact(commission.amount)}
                  note={rule ? `${describeRule(rule)}${rule.is_example ? " — example rule" : ""}` : "No commission rule set"}
                  tone="pink"
                />
              )}
              <Tile label="Your gross profit" value={money(grossProfit(me))} note={margin === null ? "No sales yet" : `${margin}% margin`} tone="teal" />
              <Tile label="Quotes sent" value={String(me.quotes_sent)} note={`${money(me.quotes_value)} quoted · ${winRate(me) ?? "—"}% won`} />
              <Tile label="Open quotes" value={money(me.open_value)} note={`${me.open_quotes} waiting for an answer`} href="/sales/quotes?status=sent" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {isSales && (
                <section className="rounded-lg border border-fp-border bg-white p-5">
                  <h2 className="mb-3 font-bold">Your commission, last 6 months</h2>
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                      <tr>
                        <th className="py-2 pr-3 font-semibold">Month</th>
                        <th className="py-2 pr-3 text-right font-semibold">Invoiced</th>
                        <th className="py-2 pr-3 text-right font-semibold">Gross profit</th>
                        <th className="py-2 pr-3 text-right font-semibold">Commission based on</th>
                        <th className="py-2 text-right font-semibold">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((m, i) => {
                        const s = historyStats[i]?.find((t) => t.owner_id === user.id) ?? sumStats([]);
                        const c = commissionFor(s, rule);
                        return (
                          <tr key={m.key} className="border-b border-fp-border last:border-0">
                            <td className="py-2 pr-3">{m.label}</td>
                            <td className="py-2 pr-3 text-right">{money(s.invoiced)}</td>
                            <td className="py-2 pr-3 text-right">{money(grossProfit(s))}</td>
                            <td className="py-2 pr-3 text-right">{money(c.base)}</td>
                            <td className="py-2 text-right font-semibold">{moneyExact(c.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {rule && (
                    <p className="mt-3 text-xs text-fp-dark/70">
                      &ldquo;Commission based on&rdquo; is the {rule.basis === "gross_profit" ? "gross profit" : "sales"} on invoices{" "}
                      {rule.counted_when === "paid" ? "paid" : "raised"} that month, which can differ from what was invoiced that month.
                    </p>
                  )}
                  {rule?.is_example && (
                    <p className="mt-3 text-xs text-fp-dark/70">
                      These use an example rule ({describeRule(rule)}). Real commission rules will be set by the directors.
                    </p>
                  )}
                </section>
              )}
              <SimpleList
                title={`Your documents in ${month.label}`}
                empty="Nothing with your name on it this month."
                rows={(myDocs ?? []).map((d) => ({
                  key: d.id,
                  href: `/sales/${d.id}`,
                  primary: `${docTypes[d.doc_type as DocType]?.label} ${d.number} · ${(d.customers as unknown as { name: string } | null)?.name ?? ""}`,
                  secondary: `${statusLabel(d.doc_type as DocType, d.status)} · ${longDate(d.issue_date)}`,
                  right: money(Number(d.total)),
                }))}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}

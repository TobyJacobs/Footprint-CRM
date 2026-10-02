import { longDate } from "@/lib/customers/display";
import {
  commissionFor, describeRule, getCommissionRules, getMonth, getTargets, getTeamStats, isoDate,
  grossProfit, marginOf, ruleForPerson, sumStats, targetFor, winRate,
} from "@/lib/dashboards/data";
import { createClient } from "@/lib/supabase/server";
import { GoalBar, SimpleList, Tile, money, moneyExact, pacePct } from "./parts";

// Sales team: their own month — target, commission, quotes to chase.
export default async function SalesDashboard({ userId }: { userId: string }) {
  const month = getMonth();
  const supabase = await createClient();
  const soon = isoDate(7);
  const today = isoDate();

  const [team, targets, rules, { data: openQuotes }, { data: recentInvoices }] = await Promise.all([
    getTeamStats(month),
    getTargets(),
    getCommissionRules(),
    supabase
      .from("sales_documents")
      .select("id, number, title, subtotal, valid_until, customers!sales_documents_customer_id_fkey(name)")
      .eq("doc_type", "quote")
      .eq("status", "sent")
      .eq("owner_id", userId)
      .order("valid_until", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("sales_documents")
      .select("id, number, status, total, due_date, customers!sales_documents_customer_id_fkey(name)")
      .eq("doc_type", "invoice")
      .eq("owner_id", userId)
      .neq("status", "draft")
      .order("issue_date", { ascending: false })
      .limit(5),
  ]);

  const me = team.find((t) => t.owner_id === userId) ?? sumStats([]);
  const target = targetFor(targets, "invoiced", userId, month);
  const rule = ruleForPerson(rules, userId);
  const commission = commissionFor(me, rule);
  const ranked = team.filter((t) => t.owner_id).sort((a, b) => b.invoiced - a.invoiced);
  const rank = ranked.findIndex((t) => t.owner_id === userId) + 1;
  const margin = marginOf(me);
  const customerName = (c: unknown) => (c as { name: string } | null)?.name ?? "";

  return (
    <div className="grid gap-6">
      <GoalBar
        title={`Your sales — ${month.label}`}
        actual={me.invoiced}
        target={target?.amount ?? null}
        pacePct={pacePct(month.dayOfMonth, month.daysInMonth)}
        example={target?.is_example}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Your commission this month"
          value={moneyExact(commission.amount)}
          note={rule ? `${describeRule(rule)}${rule.is_example ? " — example rule" : ""}` : "No commission rule set"}
          tone="pink"
          href="/hub"
        />
        <Tile label="Your gross profit" value={money(grossProfit(me))} note={margin === null ? "No sales yet" : `${margin}% margin`} tone="teal" />
        <Tile
          label="Quotes won this month"
          value={winRate(me) === null ? "—" : `${winRate(me)}%`}
          note={`${me.won} won · ${me.lost} lost · ${me.quotes_sent} sent`}
        />
        <Tile
          label="Leaderboard"
          value={rank > 0 ? `#${rank}` : "—"}
          note={rank > 0 ? `of ${ranked.length} by sales this month` : "No sales yet this month"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SimpleList
          title={`Your open quotes (${me.open_quotes} · ${money(me.open_value)})`}
          empty="No quotes waiting for an answer."
          action={{ href: "/sales/quotes?status=sent", label: "All quotes" }}
          rows={(openQuotes ?? []).map((q) => {
            const expiring = q.valid_until && q.valid_until <= soon;
            const expired = q.valid_until && q.valid_until < today;
            return {
              key: q.id,
              href: `/sales/${q.id}`,
              primary: `${q.number} · ${customerName(q.customers)}`,
              secondary: [q.title, q.valid_until ? `${expired ? "Expired" : "Valid until"} ${longDate(q.valid_until)}` : null].filter(Boolean).join(" · "),
              right: money(Number(q.subtotal)),
              tone: expired ? "red" : expiring ? "amber" : undefined,
            };
          })}
        />
        <SimpleList
          title="Your latest invoices"
          empty="No invoices yet."
          action={{ href: "/sales/invoices", label: "All invoices" }}
          rows={(recentInvoices ?? []).map((i) => ({
            key: i.id,
            href: `/sales/${i.id}`,
            primary: `${i.number} · ${customerName(i.customers)}`,
            secondary: i.status === "paid" ? "Paid" : i.due_date && i.due_date < today ? `Overdue since ${longDate(i.due_date)}` : `Due ${longDate(i.due_date)}`,
            right: money(Number(i.total)),
            tone: i.status !== "paid" && i.due_date && i.due_date < today ? "red" : undefined,
          }))}
        />
      </div>
    </div>
  );
}

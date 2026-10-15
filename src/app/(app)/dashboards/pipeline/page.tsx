import Link from "next/link";
import { Suspense } from "react";
import ChartFilters from "@/components/charts/ChartFilters";
import { MoneyBars, WonLostChart } from "@/components/charts/DashboardCharts";
import { chartColours } from "@/components/charts/SalesCharts";
import { Tile, money } from "@/components/dashboards/parts";
import { Card } from "@/components/ui";
import { longDate } from "@/lib/customers/display";
import { getPipeline, monthKeys, monthShort, periodOptions, periodRange, winRate } from "@/lib/dashboards/analytics";
import { todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { requireTab } from "../guard";

export default async function PipelineDashboard(props: PageProps<"/dashboards/pipeline">) {
  const user = await requireTab("pipeline");
  const sp = await props.searchParams;
  const months = (periodOptions as readonly number[]).includes(Number(sp.months)) ? Number(sp.months) : 12;
  const owner = user.seesAllSales && typeof sp.owner === "string" && /^[0-9a-f-]{36}$/i.test(sp.owner) ? sp.owner : "";
  const range = periodRange(months);
  const today = todayIso();
  const supabase = await createClient();

  const [p, { data: people }] = await Promise.all([
    getPipeline(range.from, range.to, owner || null),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
  ]);

  const totals = p.months.reduce(
    (s, m) => ({ quoted: s.quoted + m.quoted, quotedCount: s.quotedCount + m.quoted_count, won: s.won + m.won, wonCount: s.wonCount + m.won_count, lost: s.lost + m.lost, lostCount: s.lostCount + m.lost_count }),
    { quoted: 0, quotedCount: 0, won: 0, wonCount: 0, lost: 0, lostCount: 0 },
  );
  const rate = winRate(totals.wonCount, totals.lostCount);
  const byMonth = new Map(p.months.map((m) => [m.month, m]));
  const rows = monthKeys(range.from, range.to).map((k) => {
    const m = byMonth.get(k);
    return { label: monthShort(k), won: m?.won ?? 0, lost: m?.lost ?? 0, quoted: m?.quoted ?? 0 };
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fp-dark/75">
          Quotes sent in the period, excluding VAT. Drafts aren&apos;t counted. {!user.seesAllSales && "Only your own quotes are included."}
        </p>
        <Suspense>
          <ChartFilters months={months} owner={owner} people={user.seesAllSales ? (people ?? []).map((x) => ({ id: x.id, name: x.full_name ?? x.email })) : []} />
        </Suspense>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Waiting for an answer"
          value={money(p.openValue)}
          note={`${p.openCount} open quote${p.openCount === 1 ? "" : "s"}${p.openExpired ? ` · ${p.openExpired} past their valid-until date` : ""}`}
          tone={p.openExpired ? "amber" : undefined}
          href="/sales/quotes?status=sent"
        />
        <Tile label="Win rate" value={rate === null ? "—" : `${rate}%`} note={`${totals.wonCount} won · ${totals.lostCount} lost`} tone="pink" />
        <Tile label="Won" value={money(totals.won)} note={`From ${money(totals.quoted)} quoted (${totals.quotedCount} quotes)`} tone="teal" />
        <Tile label="Days from quote to win" value={p.avgDaysToWin === null ? "—" : String(p.avgDaysToWin)} note="Average, for quotes won in the period" />
      </div>

      <Card title="Won and lost by month">
        {totals.quotedCount === 0 ? <Empty text="No quotes sent in this period yet." /> : <WonLostChart rows={rows} />}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="By salesperson">
          {p.owners.length === 0 ? (
            <Empty text="No quotes sent in this period yet." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-fp-mid">
                <tr>
                  <th className="py-1.5">Person</th>
                  <th className="py-1.5 text-right">Quoted</th>
                  <th className="py-1.5 text-right">Won</th>
                  <th className="py-1.5 text-right">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {p.owners.map((o) => {
                  const r = winRate(o.won_count, o.lost_count);
                  return (
                    <tr key={o.owner_id ?? "none"} className="border-t border-fp-border">
                      <td className="py-2">{o.name}</td>
                      <td className="py-2 text-right">
                        {money(o.quoted)} <span className="text-xs text-fp-mid">({o.quoted_count})</span>
                      </td>
                      <td className="py-2 text-right font-semibold">
                        {money(o.won)} <span className="text-xs font-normal text-fp-mid">({o.won_count})</span>
                      </td>
                      <td className="py-2 text-right text-fp-mid">{r === null ? "—" : `${r}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Open quotes by age">
          {p.openCount === 0 ? (
            <Empty text="No quotes waiting for an answer." />
          ) : (
            <>
              <MoneyBars rows={p.ages.map((a) => ({ name: `${a.label} (${a.n})`, value: a.value }))} colour={chartColours.orange} label="Open value" />
              <p className="mt-2 text-xs text-fp-mid">Age is days since the quote&apos;s date. Older quotes are less likely to be won, so worth chasing or closing.</p>
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Biggest open quotes">
          {p.biggest.length === 0 ? (
            <Empty text="No quotes waiting for an answer." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-fp-mid">
                  <tr>
                    <th className="py-1.5">Quote</th>
                    <th className="py-1.5">Customer</th>
                    <th className="py-1.5">Sent</th>
                    <th className="py-1.5">Valid until</th>
                    <th className="py-1.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {p.biggest.map((b) => (
                    <tr key={b.id} className="border-t border-fp-border">
                      <td className="py-2">
                        <Link href={`/sales/${b.id}`} className="font-semibold hover:text-fp-pink">
                          {b.number}
                        </Link>
                        {b.owner && <p className="text-xs text-fp-mid">{b.owner}</p>}
                      </td>
                      <td className="py-2">{b.customer ?? "—"}</td>
                      <td className="py-2 whitespace-nowrap">{longDate(b.issue_date)}</td>
                      <td className={`py-2 whitespace-nowrap ${b.valid_until && b.valid_until < today ? "font-semibold text-fp-error" : ""}`}>
                        {b.valid_until ? longDate(b.valid_until) : "—"}
                      </td>
                      <td className="py-2 text-right font-semibold">{money(b.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Why quotes were lost">
          {p.reasons.length === 0 ? (
            <Empty text="No quotes lost in this period." />
          ) : (
            <ul className="grid gap-2 text-sm">
              {p.reasons.map((r) => (
                <li key={r.reason} className="flex justify-between gap-3 border-b border-fp-border pb-2 last:border-0">
                  <span>{r.reason}</span>
                  <span className="whitespace-nowrap text-fp-mid">
                    {r.n} · {money(r.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-fp-mid">{text}</p>;
}

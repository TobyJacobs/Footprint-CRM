import Link from "next/link";
import { Suspense } from "react";
import ChartFilters from "@/components/charts/ChartFilters";
import { MoneyBars, RevenueChart } from "@/components/charts/DashboardCharts";
import { chartColours } from "@/components/charts/SalesCharts";
import { Tile, money } from "@/components/dashboards/parts";
import { Card } from "@/components/ui";
import { getRevenue, lastYear, marginPct, monthKeys, monthShort, periodOptions, periodRange } from "@/lib/dashboards/analytics";
import { createClient } from "@/lib/supabase/server";
import { requireTab } from "../guard";

export default async function RevenueDashboard(props: PageProps<"/dashboards/revenue">) {
  const user = await requireTab("revenue");
  const sp = await props.searchParams;
  const months = (periodOptions as readonly number[]).includes(Number(sp.months)) ? Number(sp.months) : 12;
  const owner = user.seesAllSales && typeof sp.owner === "string" && /^[0-9a-f-]{36}$/i.test(sp.owner) ? sp.owner : "";
  const range = periodRange(months);
  const prev = lastYear(range);
  const supabase = await createClient();

  const [now, before, { data: people }] = await Promise.all([
    getRevenue(range.from, range.to, owner || null),
    getRevenue(prev.from, prev.to, owner || null),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
  ]);

  const total = now.months.reduce((s, m) => ({ net: s.net + m.net, cost: s.cost + m.cost }), { net: 0, cost: 0 });
  const totalBefore = before.months.reduce((s, m) => s + m.net, 0);
  const change = totalBefore > 0 ? Math.round(((total.net - totalBefore) / totalBefore) * 100) : null;
  const margin = marginPct(total.net, total.cost);

  const byMonth = new Map(now.months.map((m) => [m.month, m]));
  const beforeByMonth = new Map(before.months.map((m) => [m.month, m]));
  const rows = monthKeys(range.from, range.to).map((k) => {
    const m = byMonth.get(k);
    const lastKey = `${Number(k.slice(0, 4)) - 1}${k.slice(4)}`;
    return { label: monthShort(k), net: m?.net ?? 0, gp: m ? m.net - m.cost : 0, lastNet: beforeByMonth.get(lastKey)?.net ?? 0 };
  });
  const average = rows.length ? total.net / rows.length : 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fp-dark/75">
          Invoices issued or paid, excluding VAT, less credit notes. {!user.seesAllSales && "Only your own customers are included."}
        </p>
        <Suspense>
          <ChartFilters months={months} owner={owner} people={user.seesAllSales ? (people ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email })) : []} />
        </Suspense>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Invoiced" value={money(total.net)} note={`Last ${months} months`} />
        <Tile
          label="Against last year"
          value={change === null ? "—" : `${change > 0 ? "+" : ""}${change}%`}
          note={`Same months last year: ${money(totalBefore)}`}
          tone={change === null ? undefined : change >= 0 ? "teal" : "red"}
        />
        <Tile label="Gross profit" value={money(total.net - total.cost)} note={margin === null ? "No margin yet" : `${margin}% margin`} tone="teal" />
        <Tile label="Average a month" value={money(average)} note={`Over ${rows.length} months`} />
      </div>

      <Card title="Invoiced and gross profit by month">
        {total.net === 0 && totalBefore === 0 ? <Empty /> : <RevenueChart rows={rows} />}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="By account manager">
          {now.owners.length === 0 ? (
            <Empty />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-fp-mid">
                <tr>
                  <th className="py-1.5">Person</th>
                  <th className="py-1.5 text-right">Invoiced</th>
                  <th className="py-1.5 text-right">Margin £</th>
                  <th className="py-1.5 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {now.owners.map((o) => {
                  const m = marginPct(o.net, o.cost);
                  return (
                    <tr key={o.owner_id ?? "none"} className="border-t border-fp-border">
                      <td className="py-2">{o.name}</td>
                      <td className="py-2 text-right font-semibold">{money(o.net)}</td>
                      <td className="py-2 text-right">{money(o.net - o.cost)}</td>
                      <td className="py-2 text-right text-fp-mid">{m === null ? "—" : `${m}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="By sales account">
          {now.accounts.length === 0 ? (
            <Empty />
          ) : (
            <MoneyBars rows={now.accounts.slice(0, 12).map((a) => ({ name: a.name, value: a.net }))} label="Invoiced" />
          )}
        </Card>
      </div>

      <Card title="Top 10 customers">
        {now.customers.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <MoneyBars rows={now.customers.map((c) => ({ name: c.name, value: c.net }))} colour={chartColours.pink} label="Invoiced" />
            <ol className="grid content-start gap-1 text-sm">
              {now.customers.map((c, i) => (
                <li key={c.customer_id} className="flex justify-between gap-3 border-b border-fp-border py-1.5 last:border-0">
                  <Link href={`/customers/${c.customer_id}`} className="hover:text-fp-pink">
                    {i + 1}. {c.name}
                  </Link>
                  <span className="font-semibold">{money(c.net)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-fp-mid">Nothing invoiced in this period yet.</p>;
}

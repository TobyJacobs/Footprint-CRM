import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Tile, money } from "@/components/dashboards/parts";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { addDaysTo, addMonthsTo, ukToday } from "@/lib/dates";
import { monthLabel } from "@/lib/magazines";
import { getMagazineReport, periodFrom, periodQuery } from "@/lib/reports";
import { CsvLink, PeriodPicker, num, td, th } from "../parts";

export const metadata: Metadata = { title: "Magazine MI" };

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");

// Forget Me Not management information: what's booked per edition and month
// against target and pages, space sold by size, new vs returning advertisers
// and sales by salesperson. Booked = adverts on sales orders not cancelled.
export default async function MagazineReport(props: PageProps<"/reports/magazines">) {
  const user = await getCurrentUser();
  if (!user.can("magazines", "view")) redirect("/reports/sales");
  const sp = await props.searchParams;
  // Magazines are booked ahead, so the default is this month and the next five.
  const ym = ukToday().slice(0, 7);
  const period = sp.period
    ? periodFrom(sp)
    : { preset: "custom", from: `${ym}-01`, to: addDaysTo(`${addMonthsTo(ym, 6)}-01`, -1), label: "This month and the next five" };
  const r = await getMagazineReport(period.from, period.to);
  const net = r.editions.reduce((s, e) => s + e.net, 0);
  const target = r.editions.reduce((s, e) => s + e.target, 0);
  const pages = r.editions.reduce((s, e) => s + e.pages, 0);
  const booked = r.editions.reduce((s, e) => s + e.pages_booked, 0);
  const advertisers = r.months.reduce((s, m) => s + m.advertisers, 0);
  const fresh = r.months.reduce((s, m) => s + m.new_advertisers, 0);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker period={period} />
        <CsvLink href={`/reports/csv?report=magazines&${periodQuery(period)}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Booked" value={money(net)} note={`${period.label} · before VAT`} />
        <Tile label="Against target" value={pct(net, target)} note={`Target ${money(target)}`} tone={target && net >= target ? "teal" : "pink"} />
        <Tile label="Pages sold" value={`${Math.round(booked * 10) / 10} of ${pages}`} note={`${pct(booked, pages)} of all pages · ${money(booked ? net / booked : 0)} a page`} />
        <Tile label="New advertisers" value={String(fresh)} note={`First ever booking · ${advertisers} advertiser-months in all`} tone="teal" />
      </div>

      <Card title="By edition">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-fp-border">
              <tr>
                <th className={th}>Edition</th>
                <th className={`${th} text-right`}>Booked</th>
                <th className={`${th} text-right`}>Target</th>
                <th className={`${th} text-right`}>Reached</th>
                <th className={`${th} text-right`}>Adverts</th>
                <th className={`${th} text-right`}>Pages sold</th>
                <th className={`${th} text-right`}>Per page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fp-border">
              {r.editions.map((e) => (
                <tr key={e.code}>
                  <td className={`${td} font-semibold`}>
                    {e.code}. {e.name}
                  </td>
                  <td className={num}>{money(e.net)}</td>
                  <td className={`${num} text-fp-dark/70`}>{money(e.target)}</td>
                  <td className={`${num} ${e.target && e.net >= e.target ? "text-fp-teal-deep" : ""}`}>{pct(e.net, e.target)}</td>
                  <td className={num}>{e.adverts}</td>
                  <td className={num}>
                    {Math.round(e.pages_booked * 10) / 10} of {e.pages}
                  </td>
                  <td className={num}>{e.pages ? money(e.net / e.pages) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="By month">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-fp-border">
              <tr>
                <th className={th}>Issue month</th>
                <th className={`${th} text-right`}>Booked</th>
                <th className={`${th} text-right`}>Reached</th>
                <th className={`${th} text-right`}>Advertisers</th>
                <th className={`${th} text-right`}>New</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fp-border">
              {r.months.map((m) => (
                <tr key={m.month}>
                  <td className={td}>{monthLabel(m.month)}</td>
                  <td className={num}>{money(m.net)}</td>
                  <td className={num}>{pct(m.net, m.target)}</td>
                  <td className={num}>{m.advertisers}</td>
                  <td className={num}>{m.new_advertisers || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="grid content-start gap-5">
          <Card title="Space sold by size">
            {r.sizes.length === 0 ? (
              <p className="text-sm text-fp-mid">No adverts booked in this period.</p>
            ) : (
              <ul className="divide-y divide-fp-border text-sm">
                {r.sizes.map((s) => (
                  <li key={s.size} className="flex justify-between gap-3 py-1.5">
                    <span>{s.size}</span>
                    <span className="tabular-nums">
                      {s.adverts} · <strong>{money(s.net)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="By salesperson">
            {r.salespeople.length === 0 ? (
              <p className="text-sm text-fp-mid">No adverts booked in this period.</p>
            ) : (
              <ul className="divide-y divide-fp-border text-sm">
                {r.salespeople.map((s) => (
                  <li key={s.name} className="flex justify-between gap-3 py-1.5">
                    <span>{s.name}</span>
                    <span className="tabular-nums">
                      {s.adverts} adverts · <strong>{money(s.net)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <p className="text-xs text-fp-mid">
        Booked = adverts on sales orders that aren&apos;t cancelled, by the issue they appear in, before VAT. Targets and pages come from Magazines → Setup.
        &ldquo;New&rdquo; = an advertiser&apos;s first ever booked month.
      </p>
    </div>
  );
}

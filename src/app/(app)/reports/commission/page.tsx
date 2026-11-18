import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Tile, money } from "@/components/dashboards/parts";
import { Badge, Card, inputClass, secondaryButton } from "@/components/ui";
import { ukToday } from "@/lib/dates";
import { monthLabel } from "@/lib/magazines";
import { measureText, type CommissionRow } from "@/lib/commission";
import { createClient } from "@/lib/supabase/server";
import { td, th } from "../parts";

export const metadata: Metadata = { title: "Commission" };

// Sales commission (Jack Burton's rules, 16 November 2026): each person's
// monthly targets, how far they've got, the band reached and the commission.
// Directors and named viewers only (the database checks too).
export default async function CommissionReport(props: PageProps<"/reports/commission">) {
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_see_commission");
  if (allowed !== true) redirect("/reports/sales");
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : ukToday().slice(0, 7);
  const { data, error } = await supabase.rpc("commission_report", { p_month: `${month}-01` });
  const rows = ((data ?? []) as CommissionRow[]).map((r) => ({ ...r, actual: Number(r.actual), target: Number(r.target), reached: Number(r.reached), commission: Number(r.commission) }));
  const people = [...new Set(rows.map((r) => r.person))];
  const total = rows.reduce((s, r) => s + r.commission, 0);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Month</span>
            <input type="month" name="month" defaultValue={month} className={`${inputClass} w-auto`} />
          </label>
          <button type="submit" className={secondaryButton}>
            Show
          </button>
        </form>
        <Link href="/reports/commission/settings" className={secondaryButton}>
          Targets and bands
        </Link>
      </div>
      {error && <p className="text-sm text-fp-error">Couldn&apos;t work out commission: {error.message}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Commission" value={money(total)} note={`${monthLabel(`${month}-01`)} · invoiced sales`} tone="teal" />
        <Tile label="Targets hit" value={`${rows.filter((r) => r.reached >= 100).length} of ${rows.length}`} note="100% or more of target" />
        <Tile label="People" value={String(people.length)} note={rows.some((r) => !r.has_login) ? "Some haven't signed in yet" : "All signed in"} tone={rows.some((r) => !r.has_login) ? "pink" : "teal"} />
      </div>

      {rows.length === 0 ? (
        <Card title="No targets yet">
          <p className="text-sm text-fp-mid">
            Add each salesperson&apos;s targets and bands in{" "}
            <Link href="/reports/commission/settings" className="font-semibold text-fp-teal-deep hover:underline">
              Targets and bands
            </Link>
            .
          </p>
        </Card>
      ) : (
        people.map((p) => {
          const mine = rows.filter((r) => r.person === p);
          return (
            <Card key={p} title={`${p} · ${money(mine.reduce((s, r) => s + r.commission, 0))}`}>
              {!mine[0].has_login && (
                <p className="mb-3 rounded-md bg-fp-amber/15 px-3 py-2 text-sm">
                  {p} hasn&apos;t signed in to FootprintOS yet, so no sales are credited to them. Once they sign in, put their name on their quotes and orders.
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-fp-border">
                    <tr>
                      <th className={th}>Target</th>
                      <th className={th}>Counts</th>
                      <th className={`${th} text-right`}>Target</th>
                      <th className={`${th} text-right`}>So far</th>
                      <th className={`${th} text-right`}>Reached</th>
                      <th className={th}>Band</th>
                      <th className={`${th} text-right`}>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mine.map((r) => (
                      <tr key={r.id} className="border-b border-fp-border align-top last:border-0">
                        <td className={`${td} font-semibold`}>{r.label}</td>
                        <td className={td}>{measureText(r)}</td>
                        <td className={`${td} text-right`}>{money(r.target)}</td>
                        <td className={`${td} text-right`}>{money(r.actual)}</td>
                        <td className={`${td} text-right`}>{r.reached}%</td>
                        <td className={td}>
                          {r.band !== null ? (
                            <Badge tone={r.reached >= 100 ? "teal" : "amber"}>
                              {Number(r.band)}%: {r.payout === "percent" ? `${Number(r.band_amount)}%` : money(Number(r.band_amount))}
                            </Badge>
                          ) : (
                            <span className="text-fp-mid">Not reached</span>
                          )}
                          {r.next_band !== null && r.to_next !== null && (
                            <span className="block text-xs text-fp-mid">
                              {money(Number(r.to_next))} more for the {Number(r.next_band)}% band
                            </span>
                          )}
                        </td>
                        <td className={`${td} text-right font-semibold`}>{money(r.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })
      )}
      <p className="text-xs text-fp-mid">
        Sales count in the month they&apos;re invoiced (credit notes take away). The highest band reached applies to all of the figure. Revenue is sales
        before VAT; GP is sales minus cost. Only Directors and Jack Burton can see this page.
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, Notice, inputClass, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { gbp } from "@/lib/customers/display";
import { addMonthsTo, ukMonth } from "@/lib/dates";
import { monthLabel } from "@/lib/magazines";
import { createClient } from "@/lib/supabase/server";
import { markRenewal } from "../actions";
import MagazineTabs from "../MagazineTabs";

export const metadata: Metadata = { title: "Magazine renewals" };

type Renewal = {
  customer_id: string;
  customer_name: string;
  owner_id: string | null;
  owner_name: string | null;
  last_month: string;
  months_ago: number;
  has_future: boolean;
  score: number;
  reason: string;
  opportunity: number;
  mark: "contacted" | "carried_forward" | "out" | null;
  note: string | null;
};

const markLabel: Record<string, string> = { contacted: "Contacted", carried_forward: "Carried forward", out: "Definitely out" };
const views = [
  { key: "todo", label: "To do", test: (r: Renewal) => !r.mark },
  { key: "contacted", label: "Contacted", test: (r: Renewal) => r.mark === "contacted" },
  { key: "carried_forward", label: "Carried forward", test: (r: Renewal) => r.mark === "carried_forward" },
  { key: "out", label: "Definitely out", test: (r: Renewal) => r.mark === "out" },
  { key: "all", label: "All", test: () => true },
];
const scoreTone = (s: number) => (s >= 15 ? "pink" : s >= 8 ? "amber" : "grey") as "pink" | "amber" | "grey";

// Advertisers who booked an earlier issue but nothing this month, highest
// score first (Mag Manager's scoring), so the sales team know who to call.
export default async function RenewalsPage(props: PageProps<"/magazines/renewals">) {
  const user = await getCurrentUser();
  if (!user.can("magazines", "view")) return <NoAccess title="Magazine renewals" />;
  const sp = await props.searchParams;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : addMonthsTo(ukMonth(), 1);
  const view = views.find((v) => v.key === sp.show) ?? views[0];
  const who = typeof sp.who === "string" ? sp.who : "";
  const canMark = user.can("magazines", "edit") || user.can("quotes", "edit");

  const supabase = await createClient();
  const { data } = await supabase.rpc("magazine_renewals", { p_month: `${month}-01` });
  const all = ((data ?? []) as Renewal[]).map((r) => ({ ...r, opportunity: Number(r.opportunity) }));
  const people = [...new Map(all.filter((r) => r.owner_id).map((r) => [r.owner_id as string, r.owner_name ?? "Unknown"])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const mine = who ? all.filter((r) => (who === "none" ? !r.owner_id : r.owner_id === who)) : all;
  const rows = mine.filter(view.test);
  const link = (q: Record<string, string>) => {
    const p = new URLSearchParams({ month, ...(view.key !== "todo" ? { show: view.key } : {}), ...(who ? { who } : {}), ...q });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/magazines/renewals?${p}`;
  };

  return (
    <>
      <PageHeader title="Magazines" intro="Forget Me Not: advertisers who booked before but not this month, highest score first." />
      <MagazineTabs current="renewals" canEdit={user.can("magazines", "edit")} />
      <div className="grid gap-6 px-6 py-8 lg:px-10">
        <Notice searchParams={sp} />
        <div className="flex flex-wrap items-center gap-3">
          <Link href={link({ month: addMonthsTo(month, -1) })} className={secondaryButton}>
            ← {monthLabel(addMonthsTo(month, -1))}
          </Link>
          <h2 className="text-xl font-black">Renewals for {monthLabel(month)}</h2>
          <Link href={link({ month: addMonthsTo(month, 1) })} className={secondaryButton}>
            {monthLabel(addMonthsTo(month, 1))} →
          </Link>
          <form method="get" className="ml-auto flex items-center gap-2 text-sm">
            <input type="hidden" name="month" value={month} />
            {view.key !== "todo" && <input type="hidden" name="show" value={view.key} />}
            <label htmlFor="who" className="font-semibold">
              Salesperson
            </label>
            <select id="who" name="who" defaultValue={who} className={`${inputClass} w-auto`}>
              <option value="">Everyone</option>
              {people.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
              <option value="none">No salesperson</option>
            </select>
            <button type="submit" className={secondaryButton}>
              Show
            </button>
          </form>
        </div>

        <nav aria-label="Show" className="flex flex-wrap gap-2 text-sm">
          {views.map((v) => {
            const n = mine.filter(v.test).length;
            return (
              <Link
                key={v.key}
                href={link({ show: v.key === "todo" ? "" : v.key })}
                aria-current={v.key === view.key ? "page" : undefined}
                className={`rounded-full border px-3 py-1 font-semibold ${
                  v.key === view.key ? "border-fp-pink bg-fp-pink text-white" : "border-fp-border bg-white hover:border-fp-pink"
                }`}
              >
                {v.label} ({n})
              </Link>
            );
          })}
        </nav>

        <Card title={`${rows.length} advertiser${rows.length === 1 ? "" : "s"} · ${gbp(rows.reduce((s, r) => s + r.opportunity, 0))} opportunity`}>
          {rows.length === 0 ? (
            <p className="text-sm text-fp-mid">Nobody here.</p>
          ) : (
            <ul className="divide-y divide-fp-border text-sm">
              {rows.map((r) => (
                <li key={r.customer_id} className="grid gap-3 py-3 lg:grid-cols-[3rem_1fr_auto]">
                  <div>
                    <Badge tone={scoreTone(r.score)}>{r.score}</Badge>
                  </div>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={`/customers/${r.customer_id}`} className="font-semibold text-fp-teal-deep hover:underline">
                        {r.customer_name}
                      </Link>
                      <span className="font-semibold">{gbp(r.opportunity)}</span>
                      {r.mark && <Badge tone={r.mark === "out" ? "grey" : "teal"}>{markLabel[r.mark]}</Badge>}
                    </p>
                    <p className="text-xs text-fp-mid">
                      {r.reason} · last booked {monthLabel(r.last_month)} · {r.owner_name ?? "no salesperson"}
                    </p>
                    {r.note && <p className="mt-1 whitespace-pre-wrap text-xs">{r.note}</p>}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {user.can("quotes", "edit") && (
                      <Link href={`/sales/new?type=quote&kind=advertising&customer=${r.customer_id}`} className={secondaryButton}>
                        New advertising quote
                      </Link>
                    )}
                    {canMark && (
                      <details className="relative">
                        <summary className={`${secondaryButton} cursor-pointer list-none`}>Mark…</summary>
                        <form
                          action={markRenewal.bind(null, r.customer_id, month)}
                          className="absolute right-0 z-10 mt-1 grid w-72 gap-2 rounded-md border border-fp-border bg-white p-3 shadow-lg"
                        >
                          <select name="status" defaultValue={r.mark ?? ""} aria-label="Status" className={inputClass}>
                            <option value="">Not marked</option>
                            <option value="contacted">Contacted</option>
                            <option value="carried_forward">Carried forward</option>
                            <option value="out">Definitely out</option>
                          </select>
                          <textarea name="note" rows={2} maxLength={2000} defaultValue={r.note ?? ""} placeholder="Note (optional)" aria-label="Note" className={inputClass} />
                          <button type="submit" className={secondaryButton}>
                            Save
                          </button>
                        </form>
                      </details>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <p className="text-xs text-fp-mid">
          Scores (as in Mag Manager): booked last month 20, 2 months ago 16, 3 months ago 12, 4–6 months ago 8, 7–12 months ago 4; one less if they already have
          bookings after this month. Opportunity = what they spent in their last booked month, before VAT. &ldquo;Definitely out&rdquo; keeps them off later months
          until they book again.
        </p>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { Tile } from "@/components/dashboards/parts";
import { Badge, Card, inputClass, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { addMonthsTo, ukToday } from "@/lib/dates";
import { designStageLabel, designStageTone } from "@/lib/design/options";
import { monthLabel } from "@/lib/magazines";
import { createClient } from "@/lib/supabase/server";
import { td, th } from "../parts";

export const metadata: Metadata = { title: "Magazine production" };

type Item = {
  id?: string;
  page?: number;
  kind?: "advert" | "editorial";
  title: string | null;
  size: string | null;
  order_id: string | null;
  order_number: string | null;
  cancelled?: boolean;
  artwork_stage: string | null;
  artwork_job_id: string | null;
};
type Plan = { issue: { id: string; month: string; pages: number; code: string; name: string }; placed: Item[]; unplaced: Item[] };

const READY = ["approved", "production", "done"];
const pagesText = (pages: number[]) => [...new Set(pages)].sort((a, b) => a - b).join(", ");

// Magazine reports 3 (owner, 1 November 2026): for one issue, every advert's
// artwork status and page, plus the advertiser and content indexes to print
// in the magazine. Built from the issue's flatplan.
export default async function ProductionReport(props: PageProps<"/reports/production">) {
  const user = await getCurrentUser();
  if (!user.can("magazines", "view")) redirect("/reports/sales");
  const sp = await props.searchParams;
  const supabase = await createClient();

  // Issues from last month to six months ahead, to choose from.
  const ym = ukToday().slice(0, 7);
  const { data: issues } = await supabase
    .from("magazine_issues")
    .select("id, month, magazine_editions(name, code)")
    .gte("month", `${addMonthsTo(ym, -1)}-01`)
    .lte("month", `${addMonthsTo(ym, 6)}-01`)
    .order("month");
  const list = (issues ?? []).map((i) => ({ id: i.id as string, month: i.month as string, edition: i.magazine_editions as unknown as { name: string; code: string } }));
  list.sort((a, b) => a.month.localeCompare(b.month) || a.edition.name.localeCompare(b.edition.name));
  const chosen = typeof sp.issue === "string" && list.some((i) => i.id === sp.issue) ? sp.issue : (list.find((i) => i.month.slice(0, 7) >= ym)?.id ?? list[0]?.id);

  const plan = chosen ? ((await supabase.rpc("magazine_flatplan", { p_issue: chosen })).data as Plan | null) : null;

  const adverts = plan ? [...plan.placed.filter((p) => p.kind === "advert" && !p.cancelled), ...plan.unplaced] : [];
  const editorial = plan ? plan.placed.filter((p) => p.kind === "editorial") : [];
  const ready = adverts.filter((a) => a.artwork_stage && READY.includes(a.artwork_stage)).length;
  const noJob = adverts.filter((a) => !a.artwork_job_id).length;
  const unplaced = plan ? plan.unplaced.length : 0;

  // Advertiser index: each advertiser once, with their pages.
  const byAdvertiser = new Map<string, number[]>();
  for (const a of plan?.placed ?? []) {
    if (a.kind !== "advert" || a.cancelled || !a.page) continue;
    const name = (a.title ?? "").trim() || "Advertiser";
    byAdvertiser.set(name, [...(byAdvertiser.get(name) ?? []), a.page]);
  }
  const advertiserIndex = [...byAdvertiser.entries()].sort((a, b) => a[0].localeCompare(b[0], "en-GB", { sensitivity: "base" }));
  const contentIndex = editorial.filter((e) => e.page).sort((a, b) => (a.page ?? 0) - (b.page ?? 0));

  return (
    <div className="grid gap-5">
      <form className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Issue</span>
          <select name="issue" defaultValue={chosen} className={inputClass}>
            {list.map((i) => (
              <option key={i.id} value={i.id}>
                {i.edition.name}, {monthLabel(i.month)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={secondaryButton}>
          Show
        </button>
        {plan && (
          <Link href={`/magazines/flatplan/${plan.issue.id}`} className="py-2 text-sm font-semibold text-fp-teal-deep hover:underline">
            Open the flatplan
          </Link>
        )}
        <div className="ml-auto">
          <PrintButton />
        </div>
      </form>

      {!plan ? (
        <p className="text-sm text-fp-mid">No issues to show yet.</p>
      ) : (
        <>
          <h2 className="text-lg font-black">
            {plan.issue.name}, {monthLabel(plan.issue.month)}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
            <Tile label="Adverts" value={String(adverts.length)} note={`${plan.issue.pages} pages in the issue`} />
            <Tile label="Artwork ready" value={`${ready} of ${adverts.length}`} note="Approved or further" tone={ready === adverts.length && adverts.length ? "teal" : "pink"} />
            <Tile label="No artwork job" value={String(noJob)} note={noJob ? "Request artwork on the order" : "Every advert has one"} tone={noJob ? "pink" : "teal"} />
            <Tile label="Not on a page yet" value={String(unplaced)} note={unplaced ? "Place them on the flatplan" : "All placed"} tone={unplaced ? "pink" : "teal"} />
          </div>

          <Card title="Artwork status">
            {adverts.length === 0 ? (
              <p className="text-sm text-fp-mid">No adverts booked in this issue.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-fp-border">
                    <tr>
                      <th className={th}>Advertiser</th>
                      <th className={th}>Size</th>
                      <th className={th}>Page</th>
                      <th className={th}>Order</th>
                      <th className={th}>Artwork</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...adverts]
                      .sort((a, b) => (a.page ?? 9999) - (b.page ?? 9999) || (a.title ?? "").localeCompare(b.title ?? ""))
                      .map((a, i) => (
                        <tr key={a.id ?? `${a.order_id}-${i}`} className="border-b border-fp-border last:border-0">
                          <td className={`${td} font-semibold`}>{a.title}</td>
                          <td className={td}>{a.size ?? "—"}</td>
                          <td className={td}>{a.page ?? <span className="text-fp-orange">Not placed</span>}</td>
                          <td className={td}>
                            {a.order_id ? (
                              <Link href={`/sales/${a.order_id}`} className="text-fp-teal-deep hover:underline">
                                {a.order_number}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={td}>
                            {a.artwork_job_id && a.artwork_stage ? (
                              <Link href={`/design/${a.artwork_job_id}`}>
                                <Badge tone={designStageTone(a.artwork_stage)}>{designStageLabel(a.artwork_stage)}</Badge>
                              </Link>
                            ) : (
                              <span className="text-fp-error">No artwork job</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Advertiser index">
              {advertiserIndex.length === 0 ? (
                <p className="text-sm text-fp-mid">No adverts on pages yet.</p>
              ) : (
                <ul className="columns-1 text-sm sm:columns-2">
                  {advertiserIndex.map(([name, pages]) => (
                    <li key={name} className="flex justify-between gap-3 break-inside-avoid border-b border-dotted border-fp-border py-1">
                      <span>{name}</span>
                      <span className="shrink-0 font-semibold">{pagesText(pages)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Content index">
              {contentIndex.length === 0 ? (
                <p className="text-sm text-fp-mid">No articles, puzzles or other editorial on pages yet.</p>
              ) : (
                <ul className="text-sm">
                  {contentIndex.map((e) => (
                    <li key={e.id} className="flex justify-between gap-3 border-b border-dotted border-fp-border py-1">
                      <span>{e.title}</span>
                      <span className="shrink-0 font-semibold">{e.page}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

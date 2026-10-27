import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, Notice, inputClass, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { addMonthsTo } from "@/lib/dates";
import { designStageLabel, designStageTone } from "@/lib/design/options";
import { monthLabel } from "@/lib/magazines";
import { createClient } from "@/lib/supabase/server";
import { addEditorial, moveFlatplanItem, placeAdvert, removeFlatplanItem } from "../../actions";
import MagazineTabs from "../../MagazineTabs";
import { DragItem, DropPage, FlatplanDrag } from "./FlatplanDrag";

export const metadata: Metadata = { title: "Flatplan" };

type Placed = {
  id: string;
  page: number;
  kind: "advert" | "editorial";
  line_id: string | null;
  title: string;
  size: string | null;
  fraction: number;
  order_id: string | null;
  order_number: string | null;
  cancelled: boolean;
  artwork_stage: string | null;
  artwork_job_id: string | null;
};
type Unplaced = Omit<Placed, "id" | "page" | "kind" | "cancelled"> & { line_id: string };
type Plan = {
  issue: { id: string; month: string; pages: number; complete: boolean; edition_id: string; code: string; name: string };
  placed: Placed[];
  unplaced: Unplaced[];
};

const fractionLabel = (f: number) => {
  const known: [number, string][] = [
    [2, "2 pages"], [1, "full page"], [0.75, "¾"], [0.6667, "⅔"], [0.5, "½"], [0.3333, "⅓"], [0.25, "¼"], [0.1667, "⅙"], [0.125, "⅛"], [0.0625, "1/16"],
  ];
  return known.find(([v]) => Math.abs(v - f) < 0.002)?.[1] ?? `${Math.round(f * 100)}% of a page`;
};

// One issue's page-by-page plan: drag booked adverts and editorial onto pages.
export default async function FlatplanPage(props: PageProps<"/magazines/flatplan/[issueId]">) {
  const user = await getCurrentUser();
  if (!user.can("magazines", "view")) return <NoAccess title="Flatplan" />;
  const { issueId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(issueId)) notFound();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("magazine_flatplan", { p_issue: issueId });
  const plan = data as Plan | null;
  if (!plan) notFound();
  const { issue } = plan;
  const canEdit = user.can("magazines", "edit");
  const ym = issue.month.slice(0, 7);

  const [{ data: siblings }, { data: editions }, { data: sizes }] = await Promise.all([
    supabase.from("magazine_issues").select("id, month").eq("edition_id", issue.edition_id).in("month", [`${addMonthsTo(ym, -1)}-01`, `${addMonthsTo(ym, 1)}-01`]),
    supabase.from("magazine_issues").select("id, magazine_editions(code, name)").eq("month", issue.month),
    supabase.from("advert_sizes").select("name, page_fraction").eq("active", true).order("position"),
  ]);
  const prev = siblings?.find((s) => String(s.month).startsWith(addMonthsTo(ym, -1)));
  const next = siblings?.find((s) => String(s.month).startsWith(addMonthsTo(ym, 1)));
  const otherEditions = ((editions ?? []) as unknown as { id: string; magazine_editions: { code: string; name: string } }[]).sort((a, b) =>
    a.magazine_editions.code.localeCompare(b.magazine_editions.code),
  );

  const pages = Array.from({ length: issue.pages }, (_, i) => i + 1);
  const onPage = (p: number) => plan.placed.filter((x) => x.page === p);
  const fill = (p: number) => onPage(p).reduce((s, x) => s + Number(x.fraction), 0);
  const fullPages = pages.filter((p) => fill(p) >= 0.999).length;
  const pageOptions = pages.map((p) => (
    <option key={p} value={p}>
      Page {p} {fill(p) > 0 ? `(${Math.round(fill(p) * 100)}% full)` : "(empty)"}
    </option>
  ));
  const artwork = (stage: string | null, jobId: string | null, orderId: string | null) =>
    stage && jobId ? (
      <Link href={`/design/${jobId}`} className="hover:underline">
        <Badge tone={designStageTone(stage)}>{designStageLabel(stage)}</Badge>
      </Link>
    ) : orderId ? (
      <Link href={`/sales/${orderId}`} className="hover:underline">
        <Badge tone="pink">Artwork needed</Badge>
      </Link>
    ) : null;

  return (
    <>
      <PageHeader title="Magazines" intro="Forget Me Not flatplans: drag booked adverts and editorial onto pages." />
      <MagazineTabs current="dashboard" canEdit={canEdit} />
      <div className="grid gap-6 px-6 py-8 lg:px-10">
        <Notice searchParams={sp} />
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/magazines?month=${ym}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
            ← Dashboard
          </Link>
          <h2 className="text-xl font-black">
            {issue.code}. {issue.name} · {monthLabel(issue.month)}
          </h2>
          {issue.complete && <Badge tone="grey">Complete</Badge>}
          <span className="text-sm text-fp-dark/75">
            {issue.pages} pages · {fullPages} full · {plan.unplaced.length} advert{plan.unplaced.length === 1 ? "" : "s"} to place
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            {prev && (
              <Link href={`/magazines/flatplan/${prev.id}`} className={secondaryButton}>
                ← {monthLabel(prev.month)}
              </Link>
            )}
            {next && (
              <Link href={`/magazines/flatplan/${next.id}`} className={secondaryButton}>
                {monthLabel(next.month)} →
              </Link>
            )}
            <form method="get" action="/magazines/flatplan" className="flex items-center gap-2">
              <select name="issue" defaultValue={issue.id} aria-label="Edition" className={`${inputClass} w-auto`}>
                {otherEditions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.magazine_editions.code}. {e.magazine_editions.name}
                  </option>
                ))}
              </select>
              <button type="submit" className={secondaryButton}>
                Go
              </button>
            </form>
          </div>
        </div>

        <FlatplanDrag issueId={issue.id}>
          <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
            <aside className="grid content-start gap-4">
              <Card title={`To place (${plan.unplaced.length})`}>
                {plan.unplaced.length === 0 ? (
                  <p className="text-sm text-fp-mid">Every booked advert is on a page.</p>
                ) : (
                  <ul className="grid gap-2 text-sm">
                    {plan.unplaced.map((u) => (
                      <li key={u.line_id}>
                        <DragItem kind="line" id={u.line_id} page={null} canDrag={canEdit} className="rounded-md border border-fp-border bg-white p-2">
                          <p className="font-semibold">{u.title}</p>
                          <p className="text-xs text-fp-mid">
                            {u.size} · {fractionLabel(Number(u.fraction))} ·{" "}
                            <Link href={`/sales/${u.order_id}`} className="hover:underline">
                              {u.order_number}
                            </Link>
                          </p>
                          <div className="mt-1">{artwork(u.artwork_stage, u.artwork_job_id, u.order_id)}</div>
                          {canEdit && (
                            <form action={placeAdvert.bind(null, issue.id, u.line_id)} className="mt-2 flex gap-1">
                              <select name="page" required defaultValue="" aria-label="Page" className={`${inputClass} py-1 text-xs`}>
                                <option value="" disabled>
                                  Put on page…
                                </option>
                                {pageOptions}
                              </select>
                              <button type="submit" className={`${secondaryButton} px-2 py-1 text-xs`}>
                                Place
                              </button>
                            </form>
                          )}
                        </DragItem>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              {canEdit && (
                <Card title="Add editorial">
                  <form action={addEditorial.bind(null, issue.id)} className="grid gap-2 text-sm">
                    <input name="title" required maxLength={200} placeholder="e.g. Editor's Letter" aria-label="Title" className={inputClass} />
                    <select name="fraction" required defaultValue="1" aria-label="Size" className={inputClass}>
                      <option value="1">Full page</option>
                      <option value="2">Double page</option>
                      {(sizes ?? [])
                        .filter((s) => Number(s.page_fraction) < 1)
                        .map((s) => (
                          <option key={s.name} value={String(s.page_fraction)}>
                            {s.name} ({fractionLabel(Number(s.page_fraction))})
                          </option>
                        ))}
                    </select>
                    <select name="page" required defaultValue="" aria-label="Page" className={inputClass}>
                      <option value="" disabled>
                        Page…
                      </option>
                      {pageOptions}
                    </select>
                    <button type="submit" className={secondaryButton}>
                      Add
                    </button>
                  </form>
                </Card>
              )}
            </aside>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {pages.map((p) => {
                const f = fill(p);
                const tone = f > 1.001 ? "border-fp-error bg-fp-error/5" : f >= 0.999 ? "border-fp-teal-deep/40 bg-fp-teal/5" : f > 0 ? "border-fp-amber/50 bg-fp-amber/5" : "border-fp-border bg-white";
                return (
                  <DropPage key={p} page={p} className={`flex min-h-56 flex-col rounded-md border-2 p-1.5 ${tone}`}>
                    <p className="mb-1 flex items-center justify-between text-xs font-bold">
                      <span>Page {p}</span>
                      <span className={f > 1.001 ? "text-fp-error" : "text-fp-mid"}>{f > 0 ? `${Math.round(f * 100)}%` : ""}</span>
                    </p>
                    <div className="flex flex-1 flex-col gap-1">
                      {onPage(p).map((x) => (
                        <DragItem
                          key={x.id}
                          kind="item"
                          id={x.id}
                          page={p}
                          canDrag={canEdit}
                          style={{ minHeight: `${Math.max(2.25, Math.min(1, Number(x.fraction)) * 12)}rem` }}
                          className={`rounded border p-1 text-[11px] leading-tight ${
                            x.kind === "editorial"
                              ? "border-fp-mid/30 bg-fp-light"
                              : x.cancelled
                                ? "border-fp-error/40 bg-fp-error/10"
                                : "border-fp-pink/30 bg-fp-pink/10"
                          }`}
                        >
                          <p className="font-semibold">{x.title}</p>
                          <p className="text-fp-mid">
                            {x.kind === "editorial" ? "Editorial" : x.size} · {fractionLabel(Number(x.fraction))}
                            {x.cancelled ? " · order cancelled" : ""}
                          </p>
                          {x.kind === "advert" && <div className="mt-0.5">{artwork(x.artwork_stage, x.artwork_job_id, x.order_id)}</div>}
                          {canEdit && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-fp-teal-deep">Move or remove</summary>
                              <form action={moveFlatplanItem.bind(null, issue.id, x.id)} className="mt-1 flex gap-1">
                                <select name="page" defaultValue={p} aria-label="Move to page" className={`${inputClass} px-1 py-0.5 text-[11px]`}>
                                  {pageOptions}
                                </select>
                                <button type="submit" className="rounded border border-fp-border bg-white px-1.5 text-[11px] font-semibold">
                                  Move
                                </button>
                              </form>
                              <form action={removeFlatplanItem.bind(null, issue.id, x.id)} className="mt-1">
                                <button type="submit" className="text-[11px] font-semibold text-fp-error hover:underline">
                                  Take off the page
                                </button>
                              </form>
                            </details>
                          )}
                        </DragItem>
                      ))}
                    </div>
                  </DropPage>
                );
              })}
            </div>
          </div>
        </FlatplanDrag>
        <p className="text-xs text-fp-mid">
          Colours: white = empty, amber = part full, green = full, red = over-full. Only adverts on sales orders appear (not quotes). Drag with a mouse, or use the boxes
          on each item.
        </p>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, Notice, inputClass, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { addMonthsTo } from "@/lib/dates";
import { designStageLabel, designStageTone } from "@/lib/design/options";
import { monthLabel } from "@/lib/magazines";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { supabaseUrl } from "@/lib/supabase/config";
import { addEditorial, addPuzzle, deletePuzzle, moveFlatplanItem, placeArticle, placeLibraryPuzzle, placeAdvert, publishFlipbook, removeFlatplanItem, removeFlipbook, removePageFile, resizeEditorial } from "../../actions";
import MagazineTabs from "../../MagazineTabs";
import WordSearchWords from "../../WordSearchWords";
import { PAGE_H, PAGE_W } from "@/lib/magazine-options";
import { difficulties, puzzleKinds } from "@/lib/puzzles";
import { DragItem, DropPage, FlatplanDrag } from "./FlatplanDrag";
import PageUploader from "./PageUploader";

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
  width_mm: number | null;
  height_mm: number | null;
  x_mm: number | null;
  y_mm: number | null;
};
type Unplaced = Omit<Placed, "id" | "page" | "kind" | "cancelled" | "x_mm" | "y_mm"> & { line_id: string };
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

  const [{ data: siblings }, { data: editions }, { data: sizes }, { data: flip }, origin, { data: pageFiles }] = await Promise.all([
    supabase.from("magazine_issues").select("id, month").eq("edition_id", issue.edition_id).in("month", [`${addMonthsTo(ym, -1)}-01`, `${addMonthsTo(ym, 1)}-01`]),
    supabase.from("magazine_issues").select("id, magazine_editions(code, name)").eq("month", issue.month),
    supabase.from("advert_sizes").select("name, page_fraction").eq("active", true).order("position"),
    supabase.from("magazine_issues").select("flipbook_published_at, magazine_editions(slug)").eq("id", issueId).maybeSingle(),
    siteUrl(),
    supabase.from("magazine_issue_pages").select("page, path, content_type").eq("issue_id", issueId),
  ]);
  // Word searches and sudoku (from the content library) in this issue, the
  // pages they're on, and the library's puzzles and articles to add.
  const [{ data: library }, { data: articles }, { data: puzzleSpots }] = await Promise.all([
    supabase.from("magazine_puzzles").select("id, kind, title, difficulty").order("created_at", { ascending: false }),
    supabase.from("magazine_articles").select("id, title").order("updated_at", { ascending: false }),
    supabase.from("magazine_flatplan_items").select("puzzle_id, puzzle_part, page").eq("issue_id", issueId).not("puzzle_id", "is", null),
  ]);
  const inIssue = new Set((puzzleSpots ?? []).map((x) => x.puzzle_id));
  const puzzles = (library ?? []).filter((pz) => inIssue.has(pz.id));
  const otherPuzzles = (library ?? []).filter((pz) => !inIssue.has(pz.id));
  const spotOf = (id: string, part: string) => (puzzleSpots ?? []).find((x) => x.puzzle_id === id && x.puzzle_part === part)?.page ?? null;
  const fileFor = (p: number) => (pageFiles ?? []).find((f) => f.page === p);
  const fileUrl = (path: string) => `${supabaseUrl}/storage/v1/object/public/flipbooks/${path.split("/").map(encodeURIComponent).join("/")}`;
  const online = !!flip?.flipbook_published_at;
  const slug = (flip?.magazine_editions as unknown as { slug: string } | null)?.slug ?? null;
  const issueLink = slug ? `${origin}/read/${slug}/${ym}` : null;
  const latestLink = slug ? `${origin}/read/${slug}` : null;
  const prev = siblings?.find((s) => String(s.month).startsWith(addMonthsTo(ym, -1)));
  const next = siblings?.find((s) => String(s.month).startsWith(addMonthsTo(ym, 1)));
  const otherEditions = ((editions ?? []) as unknown as { id: string; magazine_editions: { code: string; name: string } }[]).sort((a, b) =>
    a.magazine_editions.code.localeCompare(b.magazine_editions.code),
  );

  const pages = Array.from({ length: issue.pages }, (_, i) => i + 1);
  const onPage = (p: number) => plan.placed.filter((x) => x.page === p);
  const fill = (p: number) => onPage(p).reduce((s, x) => s + Number(x.fraction), 0);
  // Size on the page in mm (from the booked size; capped at the page area).
  const sizeOf = (x: { width_mm: number | null; height_mm: number | null; fraction: number }) => ({
    w: Math.min(PAGE_W, Number(x.width_mm ?? PAGE_W)),
    h: Math.min(PAGE_H, Number(x.height_mm ?? Math.round(PAGE_H * Math.min(1, Number(x.fraction))))),
  });
  // Items with a spot stay there; the rest are laid out in rows from the top
  // until someone drags them. Items covering each other are marked.
  const layout = (p: number) => {
    const items = onPage(p).map((x) => ({ ...x, ...sizeOf(x), x: x.x_mm === null ? null : Number(x.x_mm), y: x.y_mm === null ? null : Number(x.y_mm), clash: false }));
    let cx = 0;
    let cy = Math.max(0, ...items.filter((i) => i.y !== null).map((i) => (i.y as number) + i.h));
    let row = 0;
    for (const i of items.filter((i) => i.x === null || i.y === null)) {
      if (cx + i.w > PAGE_W + 0.1) {
        cx = 0;
        cy += row;
        row = 0;
      }
      i.x = cx;
      i.y = Math.min(cy, Math.max(0, PAGE_H - i.h));
      cx += i.w;
      row = Math.max(row, i.h);
    }
    const placedItems = items as ((typeof items)[number] & { x: number; y: number })[];
    for (const a of placedItems)
      for (const b of placedItems)
        if (a !== b && a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) a.clash = true;
    return placedItems;
  };
  const fullPages = pages.filter((p) => fill(p) >= 0.999).length;
  const pageOptions = pages.map((p) => (
    <option key={p} value={p}>
      Page {p} {fill(p) > 0 ? `(${Math.round(fill(p) * 100)}% full)` : "(empty)"}
    </option>
  ));
  const sizeOptions = [
    <option key="full" value="full">
      Full page
    </option>,
    <option key="double" value="double">
      Double page
    </option>,
    ...(sizes ?? [])
      .filter((s) => Number(s.page_fraction) < 1)
      .map((s) => (
        <option key={s.name} value={s.name}>
          {s.name} ({fractionLabel(Number(s.page_fraction))})
        </option>
      )),
  ];
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

        <Card title="Digital edition (flipbook)">
          <div className="grid gap-4 text-sm lg:grid-cols-2">
            <div className="grid content-start gap-2">
              {online ? (
                <>
                  <p>
                    <Badge tone="teal">Online</Badge>{" "}
                    <span className="text-fp-dark/75">since {new Date(flip!.flipbook_published_at!).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })}</span>
                  </p>
                  {issueLink && (
                    <p className="flex flex-wrap items-center gap-2">
                      <a href={issueLink} target="_blank" rel="noopener" className="font-semibold text-fp-teal-deep hover:underline">
                        Open this issue&apos;s flipbook
                      </a>
                      <CopyButton text={issueLink} label="Copy link" />
                    </p>
                  )}
                  <p className="text-xs text-fp-mid">Replacing a page below updates the flipbook straight away.</p>
                </>
              ) : (
                <p className="text-fp-mid">
                  Not online yet. Upload each page&apos;s finished file (PDF, JPG or PNG) on its page below, then put the flipbook online.{" "}
                  <strong>
                    {(pageFiles ?? []).filter((f) => f.page <= issue.pages).length} of {issue.pages} pages uploaded.
                  </strong>
                </p>
              )}
              {canEdit && !online && (
                <form action={publishFlipbook.bind(null, issue.id)}>
                  <button type="submit" className="rounded-md bg-fp-pink px-4 py-2 font-semibold text-white hover:bg-fp-pink/90">
                    Put the flipbook online
                  </button>
                </form>
              )}
              {canEdit && online && (
                <form action={removeFlipbook.bind(null, issue.id)}>
                  <button type="submit" className="text-xs font-semibold text-fp-error hover:underline">
                    Take the flipbook offline
                  </button>
                </form>
              )}
            </div>
            {latestLink && (
              <div className="grid content-start gap-2 rounded-md bg-fp-offwhite p-3">
                <p className="font-semibold">For the website</p>
                <p className="text-xs text-fp-dark/75">
                  This address always shows the newest {issue.name} issue, so a &ldquo;Read online&rdquo; button on the website never needs changing:
                </p>
                <p className="flex flex-wrap items-center gap-2 break-all text-xs">
                  <code>{latestLink}</code>
                  <CopyButton text={latestLink} label="Copy link" />
                </p>
                <p className="text-xs text-fp-dark/75">Or show it inside a page on forgetmenotonline.org or footprintgroup.uk:</p>
                <p className="flex flex-wrap items-center gap-2 break-all text-xs">
                  <code>{`<iframe src="${latestLink}?embed=1" style="width:100%;height:800px;border:0" title="Forget Me Not ${issue.name}"></iframe>`}</code>
                  <CopyButton text={`<iframe src="${latestLink}?embed=1" style="width:100%;height:800px;border:0" title="Forget Me Not ${issue.name}"></iframe>`} label="Copy code" />
                </p>
              </div>
            )}
          </div>
        </Card>

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
                        <DragItem kind="line" id={u.line_id} w={sizeOf(u).w} h={sizeOf(u).h} canDrag={canEdit} className="rounded-md border border-fp-border bg-white p-2">
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
                    <select name="size" required defaultValue="full" aria-label="Size" className={inputClass}>
                      {sizeOptions}
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
              <div id="puzzles" className="scroll-mt-24">
                <Card title="Puzzles">
                  {sp.puzzle === "1" && <p className="mb-2 rounded-md bg-fp-teal/10 px-2 py-1 text-xs">Puzzle ready: download the PDFs below for the page layout.</p>}
                  {puzzles.length > 0 && (
                    <ul className="mb-3 grid gap-2 text-sm">
                      {puzzles.map((pz) => {
                        const pPage = spotOf(pz.id, "puzzle");
                        const aPage = spotOf(pz.id, "answers");
                        return (
                          <li key={pz.id} className="rounded-md border border-fp-border bg-white p-2">
                            <p className="font-semibold">{pz.title}</p>
                            <p className="text-xs text-fp-mid">
                              {pPage ? `Page ${pPage}` : "Not on a page"} · answers {aPage ? `on page ${aPage}` : "not on a page"}
                            </p>
                            <p className="mt-1 flex flex-wrap gap-x-3 text-xs font-semibold">
                              <a href={`/magazines/puzzles/${pz.id}/pdf?issue=${issue.id}&view=1`} target="_blank" rel="noopener" className="text-fp-teal-deep hover:underline">
                                Puzzle PDF
                              </a>
                              <a href={`/magazines/puzzles/${pz.id}/pdf?issue=${issue.id}&part=answers&view=1`} target="_blank" rel="noopener" className="text-fp-teal-deep hover:underline">
                                Answers PDF
                              </a>
                            </p>
                            {canEdit && (
                              <form action={deletePuzzle.bind(null, issue.id, pz.id)} className="mt-1 text-xs">
                                <button type="submit" className="font-semibold text-fp-error hover:underline">
                                  Take off this issue
                                </button>
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {canEdit && otherPuzzles.length > 0 && (
                    <details className="mb-3 text-sm">
                      <summary className="cursor-pointer font-semibold text-fp-teal-deep">Add one from the content library</summary>
                      <LibraryPuzzleForm issueId={issue.id} puzzles={otherPuzzles} sizeOptions={sizeOptions} pageOptions={pageOptions} lastPage={issue.pages} />
                    </details>
                  )}
                  {canEdit ? (
                    <details className="text-sm" open={otherPuzzles.length === 0 && puzzles.length === 0}>
                    <summary className="mb-2 cursor-pointer font-semibold text-fp-teal-deep">Make a new puzzle</summary>
                    <form action={addPuzzle.bind(null, issue.id)} className="grid gap-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <select name="kind" defaultValue="wordsearch" aria-label="Puzzle" className={inputClass}>
                          {puzzleKinds.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                        <select name="difficulty" defaultValue="medium" aria-label="How hard" className={inputClass}>
                          {difficulties.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <WordSearchWords />
                      <span className="text-xs font-semibold">Puzzle</span>
                      <div className="grid grid-cols-2 gap-2">
                        <select name="size" required defaultValue="Half Page - Landscape" aria-label="Puzzle size" className={inputClass}>
                          {sizeOptions}
                        </select>
                        <select name="page" required defaultValue="" aria-label="Puzzle page" className={inputClass}>
                          <option value="" disabled>
                            Page…
                          </option>
                          {pageOptions}
                        </select>
                      </div>
                      <span className="text-xs font-semibold">Answers (on a different page)</span>
                      <div className="grid grid-cols-2 gap-2">
                        <select name="answers_size" required defaultValue="Eighth Page" aria-label="Answers size" className={inputClass}>
                          {sizeOptions}
                        </select>
                        <select name="answers_page" required defaultValue={issue.pages > 2 ? issue.pages - 1 : issue.pages} aria-label="Answers page" className={inputClass}>
                          {pageOptions}
                        </select>
                      </div>
                      <button type="submit" className={secondaryButton}>
                        Make the puzzle
                      </button>
                    </form>
                    </details>
                  ) : (
                    puzzles.length === 0 && <p className="text-sm text-fp-mid">No puzzles in this issue yet.</p>
                  )}
                </Card>
              </div>
              {canEdit && (articles ?? []).length > 0 && (
                <Card title="Free articles">
                  <form action={placeArticle.bind(null, "")} className="grid gap-2 text-sm">
                    <input type="hidden" name="back" value={`/magazines/flatplan/${issue.id}`} />
                    <input type="hidden" name="issue_id" value={issue.id} />
                    <select name="article_id" required defaultValue="" aria-label="Article" className={inputClass}>
                      <option value="" disabled>
                        Article from the content library…
                      </option>
                      {(articles ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select name="size" required defaultValue="full" aria-label="Size" className={inputClass}>
                        {sizeOptions}
                      </select>
                      <select name="page" required defaultValue="" aria-label="Page" className={inputClass}>
                        <option value="" disabled>
                          Page…
                        </option>
                        {pageOptions}
                      </select>
                    </div>
                    <button type="submit" className={secondaryButton}>
                      Add the article
                    </button>
                    <Link href="/magazines/content#articles" className="text-xs font-semibold text-fp-teal-deep hover:underline">
                      Find more free articles
                    </Link>
                  </form>
                </Card>
              )}
            </aside>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
              {pages.map((p) => {
                const f = fill(p);
                const items = layout(p);
                const clash = items.some((x) => x.clash);
                const tone = clash || f > 1.001 ? "border-fp-error bg-fp-error/5" : f >= 0.999 ? "border-fp-teal-deep/40 bg-fp-teal/5" : f > 0 ? "border-fp-amber/50 bg-fp-amber/5" : "border-fp-border bg-white";
                const file = fileFor(p);
                return (
                  <div key={p} className={`flex flex-col gap-1.5 rounded-md border-2 p-1.5 ${tone}`}>
                    <p className="flex items-center justify-between text-xs font-bold">
                      <span>Page {p}</span>
                      <span className={clash || f > 1.001 ? "text-fp-error" : "text-fp-mid"}>
                        {clash ? "Items overlap · " : ""}
                        {f > 0 ? `${Math.round(f * 100)}%` : ""}
                      </span>
                    </p>
                    <DropPage page={p} className="rounded-sm border border-fp-border bg-white">
                      {items.map((x) => (
                        <DragItem
                          key={x.id}
                          kind="item"
                          id={x.id}
                          w={x.w}
                          h={x.h}
                          canDrag={canEdit}
                          title={`${x.title} · ${x.kind === "editorial" ? "Editorial" : x.size} (${x.w} × ${x.h} mm)${canEdit ? " · drag to move" : ""}`}
                          style={{ left: `${(x.x / PAGE_W) * 100}%`, top: `${(x.y / PAGE_H) * 100}%`, width: `${(x.w / PAGE_W) * 100}%`, height: `${(x.h / PAGE_H) * 100}%` }}
                          className={`absolute overflow-hidden rounded-sm border p-0.5 text-[10px] leading-tight ${
                            x.clash
                              ? "border-fp-error bg-fp-error/20"
                              : x.kind === "editorial"
                                ? "border-fp-mid/40 bg-fp-light"
                                : x.cancelled
                                  ? "border-fp-error/40 bg-fp-error/10"
                                  : "border-fp-pink/40 bg-fp-pink/15"
                          }`}
                        >
                          <p className="truncate font-semibold">{x.title}</p>
                          <p className="truncate text-fp-mid">{x.kind === "editorial" ? "Editorial" : x.size}</p>
                        </DragItem>
                      ))}
                    </DropPage>
                    {items.length > 0 && (
                      <ul className="grid gap-1 text-[11px] leading-tight">
                        {items.map((x) => (
                          <li key={x.id} className="rounded border border-fp-border bg-white p-1">
                            <p className="font-semibold">
                              {x.title}
                              {x.cancelled ? <span className="text-fp-error"> · order cancelled</span> : null}
                            </p>
                            <p className="text-fp-mid">
                              {x.kind === "editorial" ? "Editorial" : x.size} · {fractionLabel(Number(x.fraction))}
                            </p>
                            {x.kind === "advert" && <div className="mt-0.5">{artwork(x.artwork_stage, x.artwork_job_id, x.order_id)}</div>}
                            {canEdit && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-fp-teal-deep">{x.kind === "editorial" ? "Size, move or remove" : "Move or remove"}</summary>
                                {x.kind === "editorial" && (
                                  <form action={resizeEditorial.bind(null, issue.id, x.id)} className="mt-1 flex gap-1">
                                    <select name="size" defaultValue="" aria-label="Size" className={`${inputClass} px-1 py-0.5 text-[11px]`}>
                                      <option value="" disabled>
                                        New size…
                                      </option>
                                      {sizeOptions}
                                    </select>
                                    <button type="submit" className="rounded border border-fp-border bg-white px-1.5 text-[11px] font-semibold">
                                      Change
                                    </button>
                                  </form>
                                )}
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
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="grid gap-0.5 border-t border-fp-border/60 pt-1">
                      {file && (
                        <p className="flex items-center justify-between gap-1 text-[11px]">
                          <a href={fileUrl(file.path)} target="_blank" rel="noopener" className="font-semibold text-fp-teal-deep hover:underline">
                            ✓ {file.content_type === "application/pdf" ? "PDF" : "Image"} uploaded
                          </a>
                          {canEdit && (
                            <form action={removePageFile.bind(null, issue.id, p)}>
                              <button type="submit" className="text-fp-error hover:underline">
                                Remove
                              </button>
                            </form>
                          )}
                        </p>
                      )}
                      {canEdit && <PageUploader issueId={issue.id} page={p} replacing={!!file} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </FlatplanDrag>
        <p className="text-xs text-fp-mid">
          Each page is drawn to scale (130 × 190 mm). Drag an advert or editorial to the spot where it goes, on any page; it snaps to 5 mm. Colours: white = empty,
          amber = part full, green = full, red = over-full or items overlapping. Only adverts on sales orders appear (not quotes). On a phone or tablet use the boxes
          under each page instead.
        </p>
      </div>
    </>
  );
}

// Put a puzzle from the content library into this issue (answers on another page).
function LibraryPuzzleForm({
  issueId,
  puzzles,
  sizeOptions,
  pageOptions,
  lastPage,
}: {
  issueId: string;
  puzzles: { id: string; title: string }[];
  sizeOptions: React.ReactNode;
  pageOptions: React.ReactNode;
  lastPage: number;
}) {
  return (
    <form action={placeLibraryPuzzle.bind(null, "")} className="mt-2 grid gap-2">
      <input type="hidden" name="back" value={`/magazines/flatplan/${issueId}`} />
      <input type="hidden" name="issue_id" value={issueId} />
      <select name="puzzle_id" required defaultValue="" aria-label="Puzzle" className={inputClass}>
        <option value="" disabled>
          Puzzle…
        </option>
        {puzzles.map((pz) => (
          <option key={pz.id} value={pz.id}>
            {pz.title}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <select name="size" required defaultValue="Half Page - Landscape" aria-label="Puzzle size" className={inputClass}>
          {sizeOptions}
        </select>
        <select name="page" required defaultValue="" aria-label="Puzzle page" className={inputClass}>
          <option value="" disabled>
            Page…
          </option>
          {pageOptions}
        </select>
        <select name="answers_size" required defaultValue="Eighth Page" aria-label="Answers size" className={inputClass}>
          {sizeOptions}
        </select>
        <select name="answers_page" required defaultValue={lastPage > 2 ? lastPage - 1 : lastPage} aria-label="Answers page" className={inputClass}>
          {pageOptions}
        </select>
      </div>
      <button type="submit" className={secondaryButton}>
        Add the puzzle
      </button>
    </form>
  );
}

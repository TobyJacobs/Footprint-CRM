import type { Metadata } from "next";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { longDate } from "@/lib/customers/display";
import { ukMonth } from "@/lib/dates";
import { searchGovuk, type GovukResult } from "@/lib/govuk";
import { monthLabel } from "@/lib/magazines";
import { difficulties, puzzleKinds } from "@/lib/puzzles";
import { createClient } from "@/lib/supabase/server";
import {
  deleteArticle,
  makeDraftPuzzle,
  placeArticle,
  placeLibraryPuzzle,
  remakeLibraryPuzzle,
  removeLibraryPuzzle,
  saveArticle,
  saveGovukArticle,
} from "../actions";
import MagazineTabs from "../MagazineTabs";

export const metadata: Metadata = { title: "Magazine content" };

type Use = { issue_id: string; page: number; puzzle_id: string | null; puzzle_part: string | null; article_id: string | null };
type IssueRow = { id: string; month: string; pages: number; magazine_editions: { code: string; name: string } };

// Magazines → Content (owner, 9 November 2026): everything ready to fill
// pages not sold as adverts — puzzles made by FootprintOS and free articles
// (GOV.UK, free to reuse with its credit line, or written by the team) — each
// usable in any issue's flatplan.
export default async function MagazineContentPage(props: PageProps<"/magazines/content">) {
  const user = await getCurrentUser();
  if (!user.can("magazines", "view")) return <NoAccess title="Magazine content" />;
  const canEdit = user.can("magazines", "edit");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const supabase = await createClient();

  const [{ data: puzzles }, { data: articles }, { data: uses }, { data: issues }, { data: sizes }] = await Promise.all([
    supabase.from("magazine_puzzles").select("id, kind, title, difficulty, created_at").order("created_at", { ascending: false }),
    supabase.from("magazine_articles").select("id, title, body, source, source_url, credit, updated_at").order("updated_at", { ascending: false }),
    supabase.from("magazine_flatplan_items").select("issue_id, page, puzzle_id, puzzle_part, article_id").or("puzzle_id.not.is.null,article_id.not.is.null"),
    supabase.from("magazine_issues").select("id, month, pages, magazine_editions!inner(code, name)").gte("month", `${ukMonth()}-01`).order("month").limit(400),
    supabase.from("advert_sizes").select("name, page_fraction").eq("active", true).order("position"),
  ]);

  let results: GovukResult[] = [];
  let searchError: string | null = null;
  if (q && canEdit) {
    try {
      results = await searchGovuk(q);
    } catch (e) {
      searchError = e instanceof Error ? e.message : "GOV.UK search isn't answering right now.";
    }
  }

  // Where each puzzle or article is used: "December 2026: A p5, B p5".
  const allIssues = (issues ?? []) as unknown as IssueRow[];
  const issueById = new Map(allIssues.map((i) => [i.id, i]));
  const usedIn = (list: Use[]) => {
    const byMonth = new Map<string, string[]>();
    for (const u of list) {
      const i = issueById.get(u.issue_id);
      const key = i ? monthLabel(i.month) : "Earlier issues";
      byMonth.set(key, [...(byMonth.get(key) ?? []), i ? `${i.magazine_editions.code} p${u.page}` : `p${u.page}`]);
    }
    return [...byMonth].map(([m, eds]) => `${m}: ${eds.sort().join(", ")}`).join(" · ");
  };
  const puzzleUses = (id: string) => ((uses ?? []) as Use[]).filter((u) => u.puzzle_id === id && u.puzzle_part === "puzzle");
  const articleUses = (id: string) => ((uses ?? []) as Use[]).filter((u) => u.article_id === id);

  const months = [...new Set(allIssues.map((i) => i.month))];
  const issueOptions = months.map((m) => (
    <optgroup key={m} label={monthLabel(m)}>
      {allIssues
        .filter((i) => i.month === m)
        .sort((a, b) => a.magazine_editions.code.localeCompare(b.magazine_editions.code))
        .map((i) => (
          <option key={i.id} value={i.id}>
            {monthLabel(m)} · {i.magazine_editions.code}. {i.magazine_editions.name} ({i.pages} pages)
          </option>
        ))}
    </optgroup>
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
          {s.name}
        </option>
      )),
  ];
  const small = `${inputClass} py-1 text-xs`;

  return (
    <>
      <PageHeader title="Magazines" intro="Forget Me Not content: puzzles and free articles ready to fill pages not sold as adverts." />
      <MagazineTabs current="content" canEdit={canEdit} />
      <div className="grid gap-6 px-6 py-8 lg:px-10">
        <Notice searchParams={sp} />

        {/* ─── Puzzles ─── */}
        <div id="puzzles" className="scroll-mt-24">
          <Card title={`Puzzles (${(puzzles ?? []).length})`}>
            <p className="mb-4 text-sm text-fp-dark/75">
              Word searches and sudoku made by FootprintOS. Use the same one in as many editions as you like: each issue gets the puzzle on one page and the answers
              on another.
            </p>
            <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
              {canEdit && (
                <form action={makeDraftPuzzle} className="grid content-start gap-2 rounded-md border border-fp-border p-3 text-sm">
                  <p className="font-semibold">Make a puzzle</p>
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
                  <input name="theme" maxLength={80} placeholder="Theme, e.g. Christmas (optional)" aria-label="Theme" className={inputClass} />
                  <label className="grid gap-1">
                    <span className="text-xs text-fp-mid">Word search only: the words to hide, one per line or separated by commas</span>
                    <textarea name="words" rows={5} placeholder={"Robin\nBlue tit\nSparrow…"} aria-label="Words to hide" className={inputClass} />
                  </label>
                  <select name="grid" defaultValue="12" aria-label="Word search grid" className={inputClass}>
                    {[10, 12, 15].map((n) => (
                      <option key={n} value={n}>
                        Word search grid {n} × {n}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={primaryButton}>
                    Make the puzzle
                  </button>
                </form>
              )}
              <div className="grid content-start gap-3">
                {(puzzles ?? []).length === 0 && <p className="text-sm text-fp-mid">No puzzles yet.</p>}
                {(puzzles ?? []).map((pz) => {
                  const used = puzzleUses(pz.id);
                  return (
                    <div key={pz.id} className="rounded-md border border-fp-border bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{pz.title}</p>
                        <Badge tone="grey">{difficulties.find((d) => d.value === pz.difficulty)?.label}</Badge>
                        {used.length === 0 && <Badge tone="amber">Not used yet</Badge>}
                      </div>
                      {used.length > 0 && <p className="mt-1 text-xs text-fp-mid">Used in {usedIn(used)}</p>}
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                        <a href={`/magazines/puzzles/${pz.id}/pdf?view=1`} target="_blank" rel="noopener" className="text-fp-teal-deep hover:underline">
                          Preview puzzle
                        </a>
                        <a href={`/magazines/puzzles/${pz.id}/pdf?part=answers&view=1`} target="_blank" rel="noopener" className="text-fp-teal-deep hover:underline">
                          Preview answers
                        </a>
                      </p>
                      {canEdit && (
                        <div className="mt-2 grid gap-2">
                          <details>
                            <summary className="cursor-pointer text-xs font-semibold text-fp-teal-deep">Use in an issue</summary>
                            <form action={placeLibraryPuzzle.bind(null, pz.id)} className="mt-2 grid gap-2 sm:grid-cols-2">
                              <input type="hidden" name="back" value="/magazines/content" />
                              <select name="issue_id" required defaultValue="" aria-label="Issue" className={`${small} sm:col-span-2`}>
                                <option value="" disabled>
                                  Issue…
                                </option>
                                {issueOptions}
                              </select>
                              <select name="size" defaultValue="Half Page - Landscape" aria-label="Puzzle size" className={small}>
                                {sizeOptions}
                              </select>
                              <input name="page" type="number" min={1} max={400} required placeholder="Puzzle page" aria-label="Puzzle page" className={small} />
                              <select name="answers_size" defaultValue="Eighth Page" aria-label="Answers size" className={small}>
                                {sizeOptions}
                              </select>
                              <input name="answers_page" type="number" min={1} max={400} required placeholder="Answers page" aria-label="Answers page" className={small} />
                              <button type="submit" className={`${secondaryButton} py-1 text-xs sm:col-span-2`}>
                                Put it in this issue
                              </button>
                            </form>
                          </details>
                          <div className="flex flex-wrap gap-4 text-xs">
                            <form action={remakeLibraryPuzzle.bind(null, pz.id)}>
                              <ConfirmSubmit
                                message={used.length ? "Make a new version? It changes this puzzle in every issue it's used in." : "Make a new version of this puzzle?"}
                                className="font-semibold text-fp-teal-deep hover:underline"
                              >
                                Make a new one
                              </ConfirmSubmit>
                            </form>
                            <form action={removeLibraryPuzzle.bind(null, pz.id)}>
                              <ConfirmSubmit
                                message={used.length ? `Delete ${pz.title}? It's also taken off ${used.length} issue${used.length === 1 ? "" : "s"}.` : `Delete ${pz.title}?`}
                                className="font-semibold text-fp-error hover:underline"
                              >
                                Delete
                              </ConfirmSubmit>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* ─── Articles ─── */}
        <div id="articles" className="scroll-mt-24">
          <Card title={`Free articles (${(articles ?? []).length})`}>
            <p className="mb-4 text-sm text-fp-dark/75">
              Only articles that cost nothing: from GOV.UK (free to reuse under the Open Government Licence: print the credit line with it, text only, no
              pictures) or written by the team. Shorten an article to fit by editing it.
            </p>
            {canEdit && (
              <div className="mb-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-fp-border p-3 text-sm">
                  <form method="get" action="/magazines/content#articles" className="flex gap-2">
                    <input
                      name="q"
                      defaultValue={q}
                      maxLength={100}
                      placeholder="Search GOV.UK, e.g. winter scams, energy bills, recycling"
                      aria-label="Search GOV.UK"
                      className={inputClass}
                    />
                    <button type="submit" className={secondaryButton}>
                      Search
                    </button>
                  </form>
                  {searchError && <p className="mt-2 text-fp-error">{searchError}</p>}
                  {q && !searchError && results.length === 0 && <p className="mt-2 text-fp-mid">Nothing found on GOV.UK for “{q}”.</p>}
                  {results.length > 0 && (
                    <ul className="mt-3 grid gap-2">
                      {results.map((r) => (
                        <li key={r.link} className="rounded border border-fp-border p-2">
                          <p className="font-semibold">
                            <a href={`https://www.gov.uk${r.link}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {r.title}
                            </a>
                          </p>
                          {r.description && <p className="text-xs text-fp-dark/75">{r.description}</p>}
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-xs text-fp-mid">{r.date ? longDate(r.date) : ""}</span>
                            <form action={saveGovukArticle}>
                              <input type="hidden" name="link" value={r.link} />
                              <button type="submit" className={`${secondaryButton} px-2 py-1 text-xs`}>
                                Save to the library
                              </button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <details className="rounded-md border border-fp-border p-3 text-sm">
                  <summary className="cursor-pointer font-semibold">Write your own article</summary>
                  <form action={saveArticle.bind(null, null)} className="mt-2 grid gap-2">
                    <input name="title" required maxLength={200} placeholder="Title" aria-label="Title" className={inputClass} />
                    <textarea name="body" required rows={8} maxLength={30000} placeholder="The article text" aria-label="Article text" className={inputClass} />
                    <button type="submit" className={primaryButton}>
                      Save
                    </button>
                  </form>
                </details>
              </div>
            )}
            {(articles ?? []).length === 0 ? (
              <p className="text-sm text-fp-mid">No articles yet.</p>
            ) : (
              <div className="grid gap-3">
                {(articles ?? []).map((a) => {
                  const used = articleUses(a.id);
                  const words = a.body.trim().split(/\s+/).length;
                  return (
                    <div key={a.id} className="rounded-md border border-fp-border bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{a.title}</p>
                        <Badge tone={a.source === "govuk" ? "teal" : "grey"}>{a.source === "govuk" ? "GOV.UK" : "Our own"}</Badge>
                        <span className="text-xs text-fp-mid">{words} words</span>
                        {used.length === 0 && <Badge tone="amber">Not used yet</Badge>}
                      </div>
                      {used.length > 0 && <p className="mt-1 text-xs text-fp-mid">Used in {usedIn(used)}</p>}
                      {a.credit && <p className="mt-1 text-xs italic text-fp-dark/75">Credit to print: {a.credit}</p>}
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                        <a href={`/magazines/articles/${a.id}/text`} className="text-fp-teal-deep hover:underline">
                          Download text
                        </a>
                        {a.source_url && (
                          <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="text-fp-teal-deep hover:underline">
                            Original on GOV.UK
                          </a>
                        )}
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-fp-teal-deep">{canEdit ? "Read or edit" : "Read"}</summary>
                        {canEdit ? (
                          <form action={saveArticle.bind(null, a.id)} className="mt-2 grid gap-2">
                            <input name="title" required maxLength={200} defaultValue={a.title} aria-label="Title" className={inputClass} />
                            <textarea name="body" required rows={10} maxLength={30000} defaultValue={a.body} aria-label="Article text" className={inputClass} />
                            <button type="submit" className={`${secondaryButton} justify-self-start`}>
                              Save changes
                            </button>
                          </form>
                        ) : (
                          <p className="mt-2 whitespace-pre-line">{a.body}</p>
                        )}
                      </details>
                      {canEdit && (
                        <div className="mt-2 grid gap-2">
                          <details>
                            <summary className="cursor-pointer text-xs font-semibold text-fp-teal-deep">Use in an issue</summary>
                            <form action={placeArticle.bind(null, a.id)} className="mt-2 grid gap-2 sm:grid-cols-3">
                              <input type="hidden" name="back" value="/magazines/content" />
                              <select name="issue_id" required defaultValue="" aria-label="Issue" className={`${small} sm:col-span-3`}>
                                <option value="" disabled>
                                  Issue…
                                </option>
                                {issueOptions}
                              </select>
                              <select name="size" defaultValue="full" aria-label="Size" className={small}>
                                {sizeOptions}
                              </select>
                              <input name="page" type="number" min={1} max={400} required placeholder="Page" aria-label="Page" className={small} />
                              <button type="submit" className={`${secondaryButton} py-1 text-xs`}>
                                Put it in this issue
                              </button>
                            </form>
                          </details>
                          <form action={deleteArticle.bind(null, a.id)} className="text-xs">
                            <ConfirmSubmit
                              message={used.length ? `Delete “${a.title}”? It's also taken off ${used.length} page${used.length === 1 ? "" : "s"}.` : `Delete “${a.title}”?`}
                              className="font-semibold text-fp-error hover:underline"
                            >
                              Delete
                            </ConfirmSubmit>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

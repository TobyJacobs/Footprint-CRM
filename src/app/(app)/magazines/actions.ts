"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { bool, int, num, str } from "@/lib/forms";
import { addDaysTo, addMonthsTo, customerDueDate, ukToday } from "@/lib/dates";
import { fetchGovukArticle, GOVUK_CREDIT } from "@/lib/govuk";
import { cleanWords, difficulties, isDifficulty, isPuzzleKind, makeSudoku, makeWordSearch, newSeed, type Difficulty, type Sudoku, type WordSearch } from "@/lib/puzzles";
import { createClient } from "@/lib/supabase/server";

// Magazines setup: editions, monthly issues and advert sizes. Needs Magazines
// edit; the database checks the same.

const SETUP = "/magazines/setup";

function fail(message: string, month?: string): never {
  redirect(`${SETUP}?${month ? `month=${month}&` : ""}error=${encodeURIComponent(message)}`);
}
function done(month?: string): never {
  revalidatePath("/magazines", "layout");
  redirect(`${SETUP}?${month ? `month=${month}&` : ""}saved=1`);
}

export async function saveEdition(id: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const name = str(fd, "name");
  if (!name) fail("Each edition needs a name");
  const supabase = await createClient();
  const { error } = await supabase
    .from("magazine_editions")
    .update({
      name,
      distribution: int(fd, "distribution"),
      default_pages: int(fd, "default_pages") ?? 56,
      monthly_target: num(fd, "monthly_target"),
      active: bool(fd, "active"),
    })
    .eq("id", id);
  if (error) fail(error.message);
  done();
}

export async function saveIssue(id: string, month: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const { error } = await supabase
    .from("magazine_issues")
    .update({
      pages: int(fd, "pages") ?? 0,
      copy_deadline: str(fd, "copy_deadline"),
      sales_target: num(fd, "sales_target"),
      complete: bool(fd, "complete"),
    })
    .eq("id", id);
  if (error) fail(error.message, month);
  done(month);
}

// Add the next 12 months of issues for every active edition (skipping any
// that exist), using each edition's usual pages and target.
export async function addIssueMonths(fd: FormData) {
  await requirePermission("magazines", "edit");
  const from = str(fd, "from");
  if (!from || !/^\d{4}-\d{2}$/.test(from)) fail("Choose the first month to add");
  const supabase = await createClient();
  const { data: editions, error: readError } = await supabase
    .from("magazine_editions")
    .select("id, default_pages, monthly_target")
    .eq("active", true);
  if (readError) fail(readError.message);
  const rows = (editions ?? []).flatMap((e) =>
    Array.from({ length: 12 }, (_, i) => ({
      edition_id: e.id,
      month: `${addMonthsTo(from, i)}-01`,
      pages: e.default_pages,
      sales_target: e.monthly_target,
    })),
  );
  const { error } = await supabase.from("magazine_issues").upsert(rows, { onConflict: "edition_id,month", ignoreDuplicates: true });
  if (error) fail(error.message, from);
  done(from);
}

export async function saveAdvertSize(id: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const fraction = num(fd, "page_fraction");
  if (!fraction || fraction <= 0 || fraction > 4) fail("Part of a page must be between 0 and 4 (e.g. 0.25 for a quarter)");
  const supabase = await createClient();
  const { error } = await supabase
    .from("advert_sizes")
    .update({
      width_mm: num(fd, "width_mm"),
      height_mm: num(fd, "height_mm"),
      page_fraction: fraction,
      default_price: num(fd, "default_price"),
      rate_product: str(fd, "rate_product"),
      active: bool(fd, "active"),
    })
    .eq("id", id);
  if (error) fail(error.message);
  done();
}

// One rate-card product for a year: 10 prices (under 6 months and 6 months
// or more, 1st to 5th area). An empty box removes that price.
export async function saveRates(year: number, product: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const keep: { year: number; product: string; term: string; area: number; price: number }[] = [];
  const drop: { term: string; area: number }[] = [];
  for (const term of ["short", "long"]) {
    for (let area = 1; area <= 5; area++) {
      const price = num(fd, `${term}_${area}`);
      if (price === null) drop.push({ term, area });
      else if (price < 0) fail("Prices can't be negative");
      else keep.push({ year, product, term, area, price: Math.round(price * 100) / 100 });
    }
  }
  if (keep.length) {
    const { error } = await supabase.from("magazine_rates").upsert(keep, { onConflict: "year,product,term,area" });
    if (error) fail(error.message);
  }
  for (const d of drop) {
    await supabase.from("magazine_rates").delete().eq("year", year).eq("product", product).eq("term", d.term).eq("area", d.area);
  }
  revalidatePath("/magazines", "layout");
  revalidatePath("/sales", "layout");
  redirect(`${SETUP}?year=${year}&saved=1`);
}

// Invoicing issue by issue (Wave 5, part 2): one draft invoice per sales order
// for its adverts in this month, not yet billed. Each customer's own payment
// terms set the due date. The database makes sure nothing is billed twice.
export async function invoiceMagazineMonth(month: string) {
  await requirePermission("quotes", "edit");
  await requirePermission("magazines", "view");
  const back = (q: string) => redirect(`/magazines?month=${month}&${q}`);
  if (!/^\d{4}-\d{2}$/.test(month)) back("error=Unknown month");
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("magazine_month_bookings", { p_month: `${month}-01` });
  if (error) back(`error=${encodeURIComponent(error.message)}`);
  const orderIds = [
    ...new Set(
      ((rows ?? []) as { doc_type: string; status: string; invoice_id: string | null; document_id: string }[])
        .filter((r) => r.doc_type === "sales_order" && ["open", "completed"].includes(r.status) && !r.invoice_id)
        .map((r) => r.document_id),
    ),
  ];
  if (orderIds.length === 0) back("error=Nothing left to invoice for this month");

  const [{ data: orders }, { data: settings }] = await Promise.all([
    supabase.from("sales_documents").select("id, customers!sales_documents_customer_id_fkey(invoice_due_days, invoice_due_terms)").in("id", orderIds),
    supabase.from("company_settings").select("invoice_due_days").single(),
  ]);
  const today = ukToday();
  let made = 0;
  const problems: string[] = [];
  for (const o of orders ?? []) {
    const c = o.customers as unknown as { invoice_due_days: number | null; invoice_due_terms: string | null } | null;
    const due = customerDueDate(today, c?.invoice_due_days, c?.invoice_due_terms) ?? addDaysTo(today, settings?.invoice_due_days ?? 30);
    const { data: invoiceId, error: invError } = await supabase.rpc("magazine_invoice_order", { p_order: o.id, p_month: `${month}-01`, p_due: due });
    if (invError) problems.push(invError.message);
    else if (invoiceId) made++;
  }
  revalidatePath("/magazines", "layout");
  revalidatePath("/sales", "layout");
  back(`invoiced=${made}${problems.length ? `&error=${encodeURIComponent(`${problems.length} couldn't be invoiced: ${problems[0]}`)}` : ""}`);
}

// Renewals: mark an advertiser for a month (contacted, carried forward or
// definitely out), or clear the mark.
export async function markRenewal(customerId: string, month: string, fd: FormData) {
  const back = (q: string) => redirect(`/magazines/renewals?month=${month}${q}`);
  if (!/^\d{4}-\d{2}$/.test(month)) back("&error=Unknown month");
  const status = str(fd, "status");
  const supabase = await createClient();
  if (!status) {
    const { error } = await supabase.from("magazine_renewal_marks").delete().eq("customer_id", customerId).eq("month", `${month}-01`);
    if (error) back(`&error=${encodeURIComponent(error.message)}`);
  } else {
    if (!["contacted", "carried_forward", "out"].includes(status)) back("&error=Unknown status");
    const { error } = await supabase
      .from("magazine_renewal_marks")
      .upsert({ customer_id: customerId, month: `${month}-01`, status, note: str(fd, "note")?.slice(0, 2000) ?? null }, { onConflict: "customer_id,month" });
    if (error) back(`&error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/magazines", "layout");
  back("&saved=1");
}

// ─── Flatplans ──────────────────────────────────────────────────────────────
// Put adverts and editorial on pages. The database checks an advert belongs to
// this issue and the page exists.

const flatplanBack = (issueId: string, q = "") => `/magazines/flatplan/${issueId}${q}`;
const pageFrom = (fd: FormData) => {
  const p = int(fd, "page");
  return p && p >= 1 ? p : null;
};
// Where on the page (mm from the top-left), when dragged to a spot.
const spotFrom = (fd: FormData) => {
  const x = num(fd, "x_mm");
  const y = num(fd, "y_mm");
  if (x === null || y === null) return {};
  const clamp = (v: number) => Math.round(Math.min(300, Math.max(0, v)) * 10) / 10;
  return { x_mm: clamp(x), y_mm: clamp(y) };
};
// The page area: the Full Page advert size.
const PAGE_W = 130;
const PAGE_H = 190;

export async function placeAdvert(issueId: string, lineId: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const page = pageFrom(fd);
  if (!page) redirect(flatplanBack(issueId, "?error=Choose a page"));
  const supabase = await createClient();
  const { error } = await supabase.from("magazine_flatplan_items").insert({ issue_id: issueId, line_id: lineId, page, ...spotFrom(fd) });
  if (error) redirect(flatplanBack(issueId, `?error=${encodeURIComponent(error.message)}`));
  revalidatePath("/magazines", "layout");
  redirect(flatplanBack(issueId));
}

export async function moveFlatplanItem(issueId: string, itemId: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const page = pageFrom(fd);
  if (!page) redirect(flatplanBack(issueId, "?error=Choose a page"));
  const supabase = await createClient();
  // Moved with the page box only: back to the automatic layout on that page.
  const spot = spotFrom(fd);
  const { error } = await supabase
    .from("magazine_flatplan_items")
    .update({ page, ...("x_mm" in spot ? spot : { x_mm: null, y_mm: null }) })
    .eq("id", itemId)
    .eq("issue_id", issueId);
  if (error) redirect(flatplanBack(issueId, `?error=${encodeURIComponent(error.message)}`));
  revalidatePath("/magazines", "layout");
  redirect(flatplanBack(issueId));
}

export async function removeFlatplanItem(issueId: string, itemId: string) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const { error } = await supabase.from("magazine_flatplan_items").delete().eq("id", itemId).eq("issue_id", issueId);
  if (error) redirect(flatplanBack(issueId, `?error=${encodeURIComponent(error.message)}`));
  revalidatePath("/magazines", "layout");
  redirect(flatplanBack(issueId));
}

// Editorial sizes: a full or double page, or any advert size (its mm size).
async function editorialSize(fd: FormData, field = "size") {
  const size = str(fd, field);
  if (size === "full") return { page_fraction: 1, width_mm: PAGE_W, height_mm: PAGE_H };
  if (size === "double") return { page_fraction: 2, width_mm: PAGE_W, height_mm: PAGE_H };
  if (!size) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("advert_sizes").select("page_fraction, width_mm, height_mm").eq("name", size).maybeSingle();
  if (!data) return null;
  const f = Number(data.page_fraction);
  return {
    page_fraction: f,
    width_mm: data.width_mm === null ? PAGE_W : Math.min(PAGE_W, Number(data.width_mm)),
    height_mm: data.height_mm === null ? Math.round(PAGE_H * Math.min(1, f)) : Math.min(PAGE_H, Number(data.height_mm)),
  };
}

export async function addEditorial(issueId: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const title = str(fd, "title");
  const page = pageFrom(fd);
  const size = await editorialSize(fd);
  if (!title || !page || !size) redirect(flatplanBack(issueId, "?error=Give the editorial a title, size and page"));
  const supabase = await createClient();
  const { error } = await supabase.from("magazine_flatplan_items").insert({ issue_id: issueId, page, title: title.slice(0, 200), ...size });
  if (error) redirect(flatplanBack(issueId, `?error=${encodeURIComponent(error.message)}`));
  revalidatePath("/magazines", "layout");
  redirect(flatplanBack(issueId));
}

// Change an editorial item's size (an advert's size comes from its booking).
export async function resizeEditorial(issueId: string, itemId: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const size = await editorialSize(fd);
  if (!size) redirect(flatplanBack(issueId, "?error=Choose a size"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("magazine_flatplan_items")
    .update(size)
    .eq("id", itemId)
    .eq("issue_id", issueId)
    .is("line_id", null);
  if (error) redirect(flatplanBack(issueId, `?error=${encodeURIComponent(error.message)}`));
  revalidatePath("/magazines", "layout");
  redirect(flatplanBack(issueId));
}

// ─── Flipbooks ──────────────────────────────────────────────────────────────
// The issue's PDF is uploaded from the browser into the public "flipbooks"
// store, then recorded here (replacing any earlier one).

const PAGE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

// A page's finished file (PDF, JPG or PNG) has been uploaded: remember it,
// replacing (and deleting) any earlier file for that page.
export async function recordPageFile(issueId: string, page: number, path: string, contentType: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission("magazines", "edit");
  if (!path.startsWith(`${issueId}/pages/`) || path.includes("..")) return { ok: false, error: "That upload doesn't belong to this issue" };
  if (!PAGE_TYPES.includes(contentType)) return { ok: false, error: "Pages must be a PDF, JPG or PNG" };
  if (!Number.isInteger(page) || page < 1) return { ok: false, error: "Unknown page" };
  const supabase = await createClient();
  const { data: old } = await supabase.from("magazine_issue_pages").select("path").eq("issue_id", issueId).eq("page", page).maybeSingle();
  const { error } = await supabase
    .from("magazine_issue_pages")
    .upsert({ issue_id: issueId, page, path, content_type: contentType }, { onConflict: "issue_id,page" });
  if (error) return { ok: false, error: error.message };
  if (old?.path && old.path !== path) await supabase.storage.from("flipbooks").remove([old.path]);
  revalidatePath("/magazines", "layout");
  revalidatePath("/read", "layout");
  return { ok: true };
}

export async function removePageFile(issueId: string, page: number) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const { data: old } = await supabase.from("magazine_issue_pages").delete().eq("issue_id", issueId).eq("page", page).select("path");
  if (old?.[0]?.path) await supabase.storage.from("flipbooks").remove([old[0].path]);
  revalidatePath("/magazines", "layout");
  revalidatePath("/read", "layout");
  redirect(flatplanBack(issueId, "?saved=1"));
}

// Publish the flipbook once every page has its file.
export async function publishFlipbook(issueId: string) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const [{ data: issue }, { data: files }] = await Promise.all([
    supabase.from("magazine_issues").select("pages").eq("id", issueId).maybeSingle(),
    supabase.from("magazine_issue_pages").select("page").eq("issue_id", issueId),
  ]);
  if (!issue) redirect(flatplanBack(issueId, `?error=${encodeURIComponent("Issue not found")}`));
  const have = new Set((files ?? []).map((f) => f.page));
  const missing = Array.from({ length: issue.pages }, (_, i) => i + 1).filter((p) => !have.has(p));
  if (missing.length) {
    const list = missing.length > 6 ? `${missing.slice(0, 6).join(", ")} and ${missing.length - 6} more` : missing.join(", ");
    redirect(flatplanBack(issueId, `?error=${encodeURIComponent(`Upload every page first. Still to do: page${missing.length === 1 ? "" : "s"} ${list}.`)}`));
  }
  const { error } = await supabase.from("magazine_issues").update({ flipbook_published_at: new Date().toISOString() }).eq("id", issueId);
  if (error) redirect(flatplanBack(issueId, `?error=${encodeURIComponent(error.message)}`));
  revalidatePath("/magazines", "layout");
  revalidatePath("/read", "layout");
  redirect(flatplanBack(issueId, "?saved=1"));
}

// Take the flipbook offline (the page files stay, ready to publish again).
export async function removeFlipbook(issueId: string) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const { error } = await supabase.from("magazine_issues").update({ flipbook_published_at: null }).eq("id", issueId);
  if (error) redirect(flatplanBack(issueId, `?error=${encodeURIComponent(error.message)}`));
  revalidatePath("/magazines", "layout");
  revalidatePath("/read", "layout");
  redirect(flatplanBack(issueId, "?saved=1"));
}

// ─── Advertiser categories and magazine sections (for the reports) ──────────

const listTable = (kind: string) => (kind === "section" ? "magazine_sections" : "magazine_categories");

export async function addMagazineListItem(kind: "category" | "section", fd: FormData) {
  await requirePermission("magazines", "edit");
  const name = str(fd, "name")?.slice(0, 80);
  if (!name) fail("Give it a name");
  const supabase = await createClient();
  const { error } = await supabase.from(listTable(kind)).insert({ name, position: int(fd, "position") ?? 0 });
  if (error) fail(error.code === "23505" ? `There's already one called "${name}"` : error.message);
  done();
}

export async function saveMagazineListItem(kind: "category" | "section", id: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const name = str(fd, "name")?.slice(0, 80);
  if (!name) fail("Give it a name");
  const supabase = await createClient();
  const { error } = await supabase.from(listTable(kind)).update({ name, position: int(fd, "position") ?? 0, active: bool(fd, "active") }).eq("id", id);
  if (error) fail(error.code === "23505" ? `There's already one called "${name}"` : error.message);
  done();
}

// ─── Puzzles ────────────────────────────────────────────────────────────────
// Word searches and sudoku made by FootprintOS (lib/puzzles): the puzzle goes
// on one page of the issue and its answers on another (owner, 9 November 2026).

function makePuzzle(kind: "wordsearch" | "sudoku", difficulty: Difficulty, words: string[], grid: number, seed: number) {
  if (kind === "sudoku") return { ok: true as const, data: makeSudoku(difficulty, seed) as WordSearch | Sudoku };
  const made = makeWordSearch(words, grid, difficulty, seed);
  return made.ok ? { ok: true as const, data: made.puzzle as WordSearch | Sudoku } : made;
}

export async function addPuzzle(issueId: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  function back(msg: string): never {
    redirect(flatplanBack(issueId, `?error=${encodeURIComponent(msg)}#puzzles`));
  }
  const kind = str(fd, "kind");
  const difficulty = str(fd, "difficulty") ?? "medium";
  if (!isPuzzleKind(kind) || !isDifficulty(difficulty)) back("Choose a word search or sudoku and how hard it is");
  const page = pageFrom(fd);
  const answersPage = int(fd, "answers_page");
  if (!page || !answersPage || answersPage < 1) back("Choose a page for the puzzle and one for the answers");
  if (page === answersPage) back("Put the answers on a different page from the puzzle");
  const [size, answersSize] = await Promise.all([editorialSize(fd), editorialSize(fd, "answers_size")]);
  if (!size || !answersSize) back("Choose a size for the puzzle and for the answers");

  const theme = (str(fd, "theme") ?? "").slice(0, 80);
  const grid = Math.min(20, Math.max(8, int(fd, "grid") ?? 12));
  const seed = newSeed();
  const made = makePuzzle(kind as "wordsearch" | "sudoku", difficulty as Difficulty, cleanWords(str(fd, "words") ?? ""), grid, seed);
  if (!made.ok) back(made.error);
  const level = difficulties.find((d) => d.value === difficulty)?.label ?? "";
  const title = kind === "wordsearch" ? `Word search${theme ? `: ${theme}` : ""}` : `Sudoku${theme ? `: ${theme}` : ` (${level.toLowerCase()})`}`;

  const supabase = await createClient();
  const { data: puzzle, error } = await supabase
    .from("magazine_puzzles")
    .insert({ issue_id: issueId, kind, title, difficulty, seed, data: made.data })
    .select("id")
    .single();
  if (error) back(error.message);
  const { error: itemError } = await supabase.from("magazine_flatplan_items").insert([
    { issue_id: issueId, page, title, puzzle_id: puzzle.id, puzzle_part: "puzzle", ...size },
    { issue_id: issueId, page: answersPage, title: `Answers: ${title}`, puzzle_id: puzzle.id, puzzle_part: "answers", ...answersSize },
  ]);
  if (itemError) {
    await supabase.from("magazine_puzzles").delete().eq("id", puzzle.id);
    back(itemError.message);
  }
  revalidatePath("/magazines", "layout");
  redirect(flatplanBack(issueId, "?puzzle=1#puzzles"));
}

// Not keen on it? Make a fresh one with the same words and difficulty.
export async function remakePuzzle(issueId: string, puzzleId: string) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const { data: p } = await supabase.from("magazine_puzzles").select("kind, difficulty, data").eq("id", puzzleId).maybeSingle();
  if (!p) redirect(flatplanBack(issueId, "?error=Puzzle not found#puzzles"));
  const old = p.data as WordSearch | Sudoku;
  const seed = newSeed();
  const made = makePuzzle(p.kind as "wordsearch" | "sudoku", p.difficulty as Difficulty, old.kind === "wordsearch" ? old.words : [], old.kind === "wordsearch" ? old.size : 12, seed);
  if (!made.ok) redirect(flatplanBack(issueId, `?error=${encodeURIComponent(made.error)}#puzzles`));
  const { error } = await supabase.from("magazine_puzzles").update({ seed, data: made.data }).eq("id", puzzleId);
  if (error) redirect(flatplanBack(issueId, `?error=${encodeURIComponent(error.message)}#puzzles`));
  revalidatePath("/magazines", "layout");
  redirect(flatplanBack(issueId, "?puzzle=1#puzzles"));
}

// Take a puzzle and its answers off one issue's flatplan (it stays in the
// content library for other issues).
export async function deletePuzzle(issueId: string, puzzleId: string) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const { error } = await supabase.from("magazine_flatplan_items").delete().eq("puzzle_id", puzzleId).eq("issue_id", issueId);
  if (error) redirect(flatplanBack(issueId, `?error=${encodeURIComponent(error.message)}#puzzles`));
  revalidatePath("/magazines", "layout");
  redirect(flatplanBack(issueId, "#puzzles"));
}

// ─── Content library (Magazines → Content) ──────────────────────────────────
// Puzzles and free articles ready to fill pages, each usable in any issue.

const CONTENT = "/magazines/content";
// Back to the content library or the flatplan the form was on.
const backTo = (fd: FormData) => {
  const b = str(fd, "back") ?? "";
  return /^\/magazines\/(content|flatplan\/[0-9a-f-]{36})$/i.test(b) ? b : CONTENT;
};
function contentFail(to: string, message: string): never {
  redirect(`${to}?error=${encodeURIComponent(message)}`);
}
function contentDone(to: string, q = "saved=1"): never {
  revalidatePath("/magazines", "layout");
  redirect(`${to}?${q}`);
}

export async function makeDraftPuzzle(fd: FormData) {
  await requirePermission("magazines", "edit");
  const kind = str(fd, "kind");
  const difficulty = str(fd, "difficulty") ?? "medium";
  if (!isPuzzleKind(kind) || !isDifficulty(difficulty)) contentFail(CONTENT, "Choose a word search or sudoku and how hard it is");
  const theme = (str(fd, "theme") ?? "").slice(0, 80);
  const grid = Math.min(20, Math.max(8, int(fd, "grid") ?? 12));
  const seed = newSeed();
  const made = makePuzzle(kind, difficulty, cleanWords(str(fd, "words") ?? ""), grid, seed);
  if (!made.ok) contentFail(CONTENT, made.error);
  const level = difficulties.find((d) => d.value === difficulty)?.label ?? "";
  const title = kind === "wordsearch" ? `Word search${theme ? `: ${theme}` : ""}` : `Sudoku${theme ? `: ${theme}` : ` (${level.toLowerCase()})`}`;
  const supabase = await createClient();
  const { error } = await supabase.from("magazine_puzzles").insert({ kind, title, difficulty, seed, data: made.data });
  if (error) contentFail(CONTENT, error.message);
  contentDone(CONTENT, "saved=1#puzzles");
}

export async function removeLibraryPuzzle(puzzleId: string) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const { error } = await supabase.from("magazine_puzzles").delete().eq("id", puzzleId);
  if (error) contentFail(CONTENT, error.message);
  contentDone(CONTENT, "saved=1#puzzles");
}

export async function remakeLibraryPuzzle(puzzleId: string) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const { data: p } = await supabase.from("magazine_puzzles").select("kind, difficulty, data").eq("id", puzzleId).maybeSingle();
  if (!p) contentFail(CONTENT, "Puzzle not found");
  const old = p.data as WordSearch | Sudoku;
  const seed = newSeed();
  const made = makePuzzle(p.kind as "wordsearch" | "sudoku", p.difficulty as Difficulty, old.kind === "wordsearch" ? old.words : [], old.kind === "wordsearch" ? old.size : 12, seed);
  if (!made.ok) contentFail(CONTENT, made.error);
  const { error } = await supabase.from("magazine_puzzles").update({ seed, data: made.data }).eq("id", puzzleId);
  if (error) contentFail(CONTENT, error.message);
  contentDone(CONTENT, "saved=1#puzzles");
}

// Put a library puzzle (and its answers on another page) into an issue. The
// puzzle is given, or chosen in the form ("puzzle_id") on the flatplan.
export async function placeLibraryPuzzle(givenId: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const to = backTo(fd);
  const puzzleId = givenId || str(fd, "puzzle_id");
  if (!puzzleId) contentFail(to, "Choose a puzzle");
  const issueId = str(fd, "issue_id");
  const page = pageFrom(fd);
  const answersPage = int(fd, "answers_page");
  if (!issueId || !page || !answersPage || answersPage < 1) contentFail(to, "Choose the issue, and a page for the puzzle and one for the answers");
  if (page === answersPage) contentFail(to, "Put the answers on a different page from the puzzle");
  const [size, answersSize] = await Promise.all([editorialSize(fd), editorialSize(fd, "answers_size")]);
  if (!size || !answersSize) contentFail(to, "Choose a size for the puzzle and for the answers");
  const supabase = await createClient();
  const { data: p } = await supabase.from("magazine_puzzles").select("title").eq("id", puzzleId).maybeSingle();
  if (!p) contentFail(to, "Puzzle not found");
  const { error } = await supabase.from("magazine_flatplan_items").insert([
    { issue_id: issueId, page, title: p.title, puzzle_id: puzzleId, puzzle_part: "puzzle", ...size },
    { issue_id: issueId, page: answersPage, title: `Answers: ${p.title}`, puzzle_id: puzzleId, puzzle_part: "answers", ...answersSize },
  ]);
  if (error) contentFail(to, error.message.includes("puzzle_part_idx") ? "That puzzle is already in this issue" : error.message);
  contentDone(to);
}

// Save a GOV.UK page's text as an article (free to reuse with the credit).
export async function saveGovukArticle(fd: FormData) {
  await requirePermission("magazines", "edit");
  const link = str(fd, "link") ?? "";
  let article: Awaited<ReturnType<typeof fetchGovukArticle>>;
  try {
    article = await fetchGovukArticle(link);
  } catch (e) {
    contentFail(CONTENT, e instanceof Error ? e.message : "Couldn't get that page from GOV.UK");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("magazine_articles")
    .insert({ title: article.title, body: article.body, source: "govuk", source_url: article.url, credit: GOVUK_CREDIT });
  if (error) contentFail(CONTENT, error.message);
  contentDone(CONTENT, "saved=1#articles");
}

// Write an article (or correct one: shorten a GOV.UK one to fit).
export async function saveArticle(id: string | null, fd: FormData) {
  await requirePermission("magazines", "edit");
  const title = (str(fd, "title") ?? "").slice(0, 200);
  const body = (str(fd, "body") ?? "").slice(0, 30000);
  if (!title || !body) contentFail(CONTENT, "Give the article a title and some text");
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("magazine_articles").update({ title, body }).eq("id", id)
    : await supabase.from("magazine_articles").insert({ title, body, source: "own" });
  if (error) contentFail(CONTENT, error.message);
  contentDone(CONTENT, "saved=1#articles");
}

export async function deleteArticle(id: string) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const { error } = await supabase.from("magazine_articles").delete().eq("id", id);
  if (error) contentFail(CONTENT, error.message);
  contentDone(CONTENT, "saved=1#articles");
}

// Put a library article on a page of an issue (the article is given, or
// chosen in the form on the flatplan).
export async function placeArticle(givenId: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const to = backTo(fd);
  const articleId = givenId || str(fd, "article_id");
  if (!articleId) contentFail(to, "Choose an article");
  const issueId = str(fd, "issue_id");
  const page = pageFrom(fd);
  const size = await editorialSize(fd);
  if (!issueId || !page || !size) contentFail(to, "Choose the issue, page and size");
  const supabase = await createClient();
  const { data: a } = await supabase.from("magazine_articles").select("title").eq("id", articleId).maybeSingle();
  if (!a) contentFail(to, "Article not found");
  const { error } = await supabase
    .from("magazine_flatplan_items")
    .insert({ issue_id: issueId, page, title: `Article: ${a.title}`.slice(0, 200), article_id: articleId, ...size });
  if (error) contentFail(to, error.message);
  contentDone(to);
}

import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { renderPuzzlePdf } from "@/lib/puzzle-pdf";
import type { Sudoku, WordSearch } from "@/lib/puzzles";
import { createClient } from "@/lib/supabase/server";

// "Puzzle PDF" / "Answers PDF" on the flatplan: the puzzle (or its answers)
// as a print-ready PDF at the size of its spot on the page. ?part=answers for
// the answers; ?view=1 opens it in the browser instead of downloading it.
export async function GET(request: Request, ctx: RouteContext<"/magazines/puzzles/[puzzleId]/pdf">) {
  await requirePermission("magazines", "view");
  const { puzzleId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(puzzleId)) notFound();
  const url = new URL(request.url);
  const part = url.searchParams.get("part") === "answers" ? "answers" : "puzzle";
  const supabase = await createClient();
  const [{ data: puzzle }, { data: items }] = await Promise.all([
    supabase.from("magazine_puzzles").select("title, data").eq("id", puzzleId).maybeSingle(),
    supabase.from("magazine_flatplan_items").select("page, puzzle_part, width_mm, height_mm").eq("puzzle_id", puzzleId),
  ]);
  if (!puzzle) notFound();
  const spot = (items ?? []).find((i) => i.puzzle_part === part);
  const answers = (items ?? []).find((i) => i.puzzle_part === "answers");
  const pdf = await renderPuzzlePdf({
    title: puzzle.title,
    part,
    // Taken off the flatplan: a quarter page, so it can still be downloaded.
    widthMm: Number(spot?.width_mm ?? 60),
    heightMm: Number(spot?.height_mm ?? 90),
    answersPage: answers?.page ?? null,
    data: puzzle.data as WordSearch | Sudoku,
  });
  const name = `${puzzle.title}${part === "answers" ? " answers" : ""}`.replace(/[^A-Za-z0-9 -]/g, "").trim().replace(/\s+/g, "-") || "puzzle";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.get("view") === "1" ? "inline" : "attachment"}; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

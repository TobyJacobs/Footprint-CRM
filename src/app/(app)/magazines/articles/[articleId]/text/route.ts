import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// "Download text": a library article as a plain text file for the page
// layout, with its credit line (needed for GOV.UK articles) at the end.
export async function GET(_request: Request, ctx: RouteContext<"/magazines/articles/[articleId]/text">) {
  await requirePermission("magazines", "view");
  const { articleId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) notFound();
  const supabase = await createClient();
  const { data: a } = await supabase.from("magazine_articles").select("title, body, credit").eq("id", articleId).maybeSingle();
  if (!a) notFound();
  const text = `${a.title}\n\n${a.body}${a.credit ? `\n\n${a.credit}` : ""}\n`;
  const name = a.title.replace(/[^A-Za-z0-9 -]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "article";
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.txt"`,
      "Cache-Control": "private, no-store",
    },
  });
}

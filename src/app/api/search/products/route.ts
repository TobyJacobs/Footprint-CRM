import { NextResponse, type NextRequest } from "next/server";
import { likePattern } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

// Product look-up for quote / order / invoice lines.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json([], { status: 401 });

  // ?all=1 returns every product for sale (for the dropdown on quote lines).
  const all = request.nextUrl.searchParams.get("all") === "1";
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const like = likePattern(q);
  if (!all && (q.length < 2 || !like)) return NextResponse.json([]);

  let query = supabase
    .from("products")
    .select("id, name, sku, description, unit, sale_price, cost_price, tax_rate_id, tax_rates(rate)")
    .eq("active", true)
    .order("name");
  query = all ? query.limit(5000) : query.or(`name.ilike.${like},sku.ilike.${like}`).limit(15);
  const { data } = await query;

  return NextResponse.json(
    (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      unit: p.unit,
      sale_price: Number(p.sale_price),
      cost_price: p.cost_price === null ? null : Number(p.cost_price),
      tax_rate_id: p.tax_rate_id,
      tax_rate: Number((p.tax_rates as unknown as { rate: number } | null)?.rate ?? 0),
    })),
  );
}

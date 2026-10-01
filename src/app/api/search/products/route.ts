import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Product look-up for quote / order / invoice lines.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json([], { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().replace(/[%_,()]/g, " ");
  if (q.length < 2) return NextResponse.json([]);

  const { data } = await supabase
    .from("products")
    .select("id, name, description, unit, sale_price, cost_price, tax_rate_id, tax_rates(rate)")
    .eq("active", true)
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
    .order("name")
    .limit(15);

  return NextResponse.json(
    (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      unit: p.unit,
      sale_price: Number(p.sale_price),
      cost_price: p.cost_price === null ? null : Number(p.cost_price),
      tax_rate_id: p.tax_rate_id,
      tax_rate: Number((p.tax_rates as unknown as { rate: number } | null)?.rate ?? 0),
    })),
  );
}

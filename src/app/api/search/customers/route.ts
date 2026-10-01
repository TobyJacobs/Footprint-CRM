import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Customer look-up for pickers (e.g. choosing who a quote is for).
// Runs as the signed-in person, so the database's permission rules apply.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json([], { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().replace(/[%_,()]/g, " ");
  if (q.length < 2) return NextResponse.json([]);

  const { data } = await supabase
    .from("customers")
    .select("id, name, billing_city, credit_status")
    .is("erased_at", null)
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(15);

  return NextResponse.json(data ?? []);
}

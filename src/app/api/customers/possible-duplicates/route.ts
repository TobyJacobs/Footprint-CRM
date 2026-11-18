import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Existing customers that might be the same company as one being typed in
// (name, phone or email). Runs as the signed-in person, so permissions apply.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json([], { status: 401 });

  const p = request.nextUrl.searchParams;
  const name = (p.get("name") ?? "").trim().slice(0, 200);
  const phone = (p.get("phone") ?? "").trim().slice(0, 50);
  const email = (p.get("email") ?? "").trim().slice(0, 200);
  if (name.length < 3 && !phone && !email) return NextResponse.json([]);

  const { data } = await supabase.rpc("possible_duplicate_customers", {
    p_name: name || null,
    p_phone: phone || null,
    p_email: email || null,
  });
  return NextResponse.json(data ?? []);
}

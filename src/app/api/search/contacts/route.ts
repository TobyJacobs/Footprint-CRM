import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The contacts of one customer, for the "for the attention of" picker.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json([], { status: 401 });

  const customer = request.nextUrl.searchParams.get("customer");
  if (!customer || !/^[0-9a-f-]{36}$/i.test(customer)) return NextResponse.json([]);

  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, is_primary")
    .eq("customer_id", customer)
    .is("erased_at", null)
    .order("is_primary", { ascending: false })
    .order("last_name");

  return NextResponse.json(data ?? []);
}

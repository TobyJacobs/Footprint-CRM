import { NextResponse, type NextRequest } from "next/server";
import { personName } from "@/lib/customers/display";
import { createClient } from "@/lib/supabase/server";

const lines = (...parts: (string | null)[]) => parts.map((p) => p?.trim()).filter(Boolean).join("\n") || null;

// A customer's addresses (billing, shipping and their contacts'), for the
// billing and "deliver to" boxes on a sales order.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json(null, { status: 401 });

  const customer = request.nextUrl.searchParams.get("customer");
  if (!customer || !/^[0-9a-f-]{36}$/i.test(customer)) return NextResponse.json(null);

  const [{ data: c }, { data: contacts }] = await Promise.all([
    supabase
      .from("customers")
      .select("billing_street, billing_city, billing_county, billing_postcode, shipping_street, shipping_city, shipping_county, shipping_postcode")
      .eq("id", customer)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("first_name, last_name, street, city, county, postcode")
      .eq("customer_id", customer)
      .is("erased_at", null)
      .order("is_primary", { ascending: false })
      .order("last_name"),
  ]);
  if (!c) return NextResponse.json(null);

  return NextResponse.json({
    billing: lines(c.billing_street, c.billing_city, c.billing_county, c.billing_postcode),
    shipping: lines(c.shipping_street, c.shipping_city, c.shipping_county, c.shipping_postcode),
    contacts: (contacts ?? [])
      .map((p) => ({ name: personName(p), address: lines(p.street, p.city, p.county, p.postcode) }))
      .filter((p) => p.address),
  });
}

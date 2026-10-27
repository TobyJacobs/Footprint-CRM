import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The customer portal (/portal). Customers never get a staff account: they
// sign in with a one-time emailed link and get a session token, kept in this
// cookie. Everything they see comes from the database's portal_overview,
// which only returns their own companies' records (see the
// 20261106120000_customer_portal migration).
export const PORTAL_COOKIE = "fp_portal";
export const PORTAL_SESSION_DAYS = 14;

export type PortalQuote = {
  number: string;
  title: string | null;
  kind: string | null;
  status: string;
  issue_date: string;
  valid_until: string | null;
  total: number;
  customer_name: string;
  token: string;
};

export type PortalHostingPlan = {
  name: string;
  plan_type: string | null;
  status: string | null;
  price: number | null;
  billing_frequency: string | null;
  renewal_month: string | null;
  customer_name: string;
  items: { kind: "web" | "email"; plan: string | null; domain: string | null; mailbox_qty: number | null; email_platform: string | null }[];
};

export type PortalOverview = {
  email: string;
  first_name: string | null;
  customers: { id: string; name: string }[];
  quotes: PortalQuote[];
  hosting: PortalHostingPlan[];
};

// The signed-in customer's portal, or null if they aren't signed in (or no
// longer a contact anywhere).
export async function getPortal(): Promise<PortalOverview | null> {
  await connection();
  const session = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (!session) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_overview", { p_session: session });
  return (data as PortalOverview | null) ?? null;
}

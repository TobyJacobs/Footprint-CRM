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

export type PortalContent = {
  title: string;
  channel: string;
  publish_date: string | null;
  status: "drafting" | "client_approval" | "scheduled" | "published";
  link: string | null;
  customer_name: string;
};

export type PortalCampaign = {
  name: string;
  platform: string;
  status: "planned" | "live" | "paused" | "ended";
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  spend: number;
  leads: number | null;
  results: string | null;
  customer_name: string;
};

export type PortalRetainer = {
  name: string;
  status: string | null;
  monthly_fee: number | null;
  budget_hours: number | null;
  customer_name: string;
};

export type TicketStatus = "new" | "in_progress" | "done";

export type PortalTicketSummary = {
  id: string;
  number: number;
  kind: "change" | "question";
  subject: string;
  status: TicketStatus;
  last_message_at: string;
  customer_name: string;
};

export type PortalTicket = Omit<PortalTicketSummary, "last_message_at"> & {
  created_at: string;
  messages: { from_customer: boolean; author: string | null; body: string; created_at: string }[];
};

export type PortalOverview = {
  email: string;
  first_name: string | null;
  customers: { id: string; name: string }[];
  quotes: PortalQuote[];
  hosting: PortalHostingPlan[];
  content: PortalContent[];
  campaigns: PortalCampaign[];
  retainers: PortalRetainer[];
  tickets: PortalTicketSummary[];
};

// Customer support wording, shared by the portal and the staff tab.
export const ticketKindLabel = (k: string) => (k === "change" ? "Change request" : "Question");
export const ticketStatusLabel = (s: string) => (s === "in_progress" ? "In progress" : s === "done" ? "Done" : "New");
export const ticketTone = (s: string) => (s === "done" ? "grey" : s === "in_progress" ? "amber" : "pink") as "grey" | "amber" | "pink";
export const ticketNumber = (n: number) => `SUP-${String(n).padStart(4, "0")}`;

export async function getPortalSession(): Promise<string | null> {
  await connection();
  return (await cookies()).get(PORTAL_COOKIE)?.value ?? null;
}

// The signed-in customer's portal, or null if they aren't signed in (or no
// longer a contact anywhere).
export async function getPortal(): Promise<PortalOverview | null> {
  const session = await getPortalSession();
  if (!session) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_overview", { p_session: session });
  return (data as PortalOverview | null) ?? null;
}

// One of the customer's own support conversations, or null.
export async function getPortalTicket(id: string): Promise<PortalTicket | null> {
  const session = await getPortalSession();
  if (!session || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_ticket", { p_session: session, p_ticket_id: id });
  return (data as PortalTicket | null) ?? null;
}

import "server-only";
import { addDaysTo, addMonthsTo, ukToday } from "@/lib/dates";
import { periodFrom, type Period } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

// Magazine reports 5 (owner, 1 and 16 November 2026): the companies that
// advertised in a period, their contacts and latest activity, and a mailing
// list of only the contacts who've agreed to emails (UK GDPR).

export type AdvertiserContact = {
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  primary: boolean;
  // Agreed to marketing emails: "include in emails" ticked and not opted out.
  consented: boolean;
};
export type Advertiser = {
  id: string;
  name: string;
  editions: string[];
  issues: number;
  net: number;
  lastMonth: string;
  phone: string | null;
  email: string | null;
  lastActivityOn: string | null;
  contacts: AdvertiserContact[];
};

export async function getAdvertisers(from: string, to: string, edition?: string | null): Promise<Advertiser[]> {
  const supabase = await createClient();
  let q = supabase
    .from("sales_document_lines")
    .select(
      "line_net, magazine_issue_id, magazine_issues!inner(month, edition_id, magazine_editions(name)), sales_documents!sales_document_lines_document_id_fkey!inner(doc_type, status, customer_id)",
    )
    .not("magazine_issue_id", "is", null)
    .gte("magazine_issues.month", from)
    .lte("magazine_issues.month", to);
  if (edition) q = q.eq("magazine_issues.edition_id", edition);
  const { data: lines } = await q;

  const by = new Map<string, { editions: Set<string>; issues: Set<string>; net: number; lastMonth: string }>();
  for (const l of lines ?? []) {
    const d = l.sales_documents as unknown as { doc_type: string; status: string; customer_id: string };
    if (d.doc_type !== "sales_order" || d.status === "cancelled") continue;
    const i = l.magazine_issues as unknown as { month: string; magazine_editions: { name: string } | null };
    const a = by.get(d.customer_id) ?? { editions: new Set<string>(), issues: new Set<string>(), net: 0, lastMonth: "" };
    if (i.magazine_editions?.name) a.editions.add(i.magazine_editions.name);
    a.issues.add(l.magazine_issue_id as string);
    a.net += Number(l.line_net);
    if (i.month > a.lastMonth) a.lastMonth = i.month;
    by.set(d.customer_id, a);
  }
  const ids = [...by.keys()];
  if (!ids.length) return [];

  const [{ data: customers }, { data: contacts }] = await Promise.all([
    supabase.from("customers_with_flags").select("id, name, phone, email, last_activity_on, erased_at").in("id", ids),
    supabase
      .from("contacts")
      .select("customer_id, first_name, last_name, job_title, email, phone, mobile, is_primary, include_in_emails, email_opt_out, erased_at")
      .in("customer_id", ids),
  ]);
  const contactsOf = new Map<string, AdvertiserContact[]>();
  for (const c of contacts ?? []) {
    if (c.erased_at) continue;
    const list = contactsOf.get(c.customer_id as string) ?? [];
    list.push({
      name: [c.first_name, c.last_name].filter(Boolean).join(" "),
      email: (c.email as string | null)?.trim() || null,
      phone: (c.phone as string | null) || (c.mobile as string | null) || null,
      jobTitle: c.job_title as string | null,
      primary: !!c.is_primary,
      consented: !!c.include_in_emails && !c.email_opt_out,
    });
    contactsOf.set(c.customer_id as string, list);
  }

  return (customers ?? [])
    .filter((c) => !c.erased_at)
    .map((c) => {
      const a = by.get(c.id as string)!;
      return {
        id: c.id as string,
        name: c.name as string,
        editions: [...a.editions].sort(),
        issues: a.issues.size,
        net: Math.round(a.net * 100) / 100,
        lastMonth: a.lastMonth,
        phone: c.phone as string | null,
        email: c.email as string | null,
        lastActivityOn: c.last_activity_on as string | null,
        contacts: (contactsOf.get(c.id as string) ?? []).sort((x, y) => Number(y.primary) - Number(x.primary) || x.name.localeCompare(y.name)),
      };
    })
    .sort((x, y) => x.name.localeCompare(y.name, "en-GB", { sensitivity: "base" }));
}

// The mailing list: consented contacts with an email address, one row each.
export function mailingList(advertisers: Advertiser[]) {
  const seen = new Set<string>();
  const rows: { first: string; last: string; email: string; company: string; editions: string }[] = [];
  for (const a of advertisers) {
    for (const c of a.contacts) {
      if (!c.consented || !c.email || seen.has(c.email.toLowerCase())) continue;
      seen.add(c.email.toLowerCase());
      const [first, ...rest] = c.name.split(" ");
      rows.push({ first: first ?? "", last: rest.join(" "), email: c.email, company: a.name, editions: a.editions.join("; ") });
    }
  }
  return rows;
}

// The default period: issues in the last 12 months and the next 6.
export function advertiserPeriod(sp: Record<string, string | string[] | undefined>): Period {
  if (sp.period) return periodFrom(sp);
  const ym = ukToday().slice(0, 7);
  return { preset: "custom", from: `${addMonthsTo(ym, -12)}-01`, to: addDaysTo(`${addMonthsTo(ym, 7)}-01`, -1), label: "Last 12 months and the next 6" };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Who gets an email with their copy of an issue (owner, 16 November 2026):
// each advertiser with an advert in the issue (orders not cancelled), once,
// with the pages their adverts are on. Sent to the order's contact, or the
// customer's own email if the contact has none.
export type CopyRecipient = {
  customerId: string;
  name: string;
  firstName: string | null;
  email: string | null;
  pages: number[];
  ownerEmail: string | null;
  ownerName: string | null;
  orderId: string;
  sentAt: string | null;
};

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export async function loadCopyRecipients(supabase: SupabaseClient, issueId: string): Promise<CopyRecipient[]> {
  const { data: lines } = await supabase
    .from("sales_document_lines")
    .select(
      "id, sales_documents!sales_document_lines_document_id_fkey!inner(id, doc_type, status, customer_id, customers!sales_documents_customer_id_fkey(name, email), contacts(first_name, email), owner:owner_id(full_name, email))",
    )
    .eq("magazine_issue_id", issueId);
  const ids = (lines ?? []).map((l) => l.id as string);
  const [{ data: placed }, { data: sent }] = await Promise.all([
    ids.length ? supabase.from("magazine_flatplan_items").select("line_id, page").in("line_id", ids) : Promise.resolve({ data: [] }),
    supabase.from("magazine_copy_emails").select("customer_id, sent_at").eq("issue_id", issueId).in("status", ["sent", "test"]),
  ]);
  const pageOf = new Map((placed ?? []).map((p) => [p.line_id as string, p.page as number]));
  const sentFor = new Map((sent ?? []).map((s) => [s.customer_id as string, s.sent_at as string]));

  const byCustomer = new Map<string, CopyRecipient>();
  for (const l of lines ?? []) {
    const d = l.sales_documents as unknown as {
      id: string;
      doc_type: string;
      status: string;
      customer_id: string;
      customers: { name: string; email: string | null } | null;
      contacts: { first_name: string | null; email: string | null } | null;
      owner: { full_name: string | null; email: string } | null;
    };
    if (d.doc_type !== "sales_order" || d.status === "cancelled") continue;
    const page = pageOf.get(l.id as string);
    const existing = byCustomer.get(d.customer_id);
    if (existing) {
      if (page) existing.pages.push(page);
      continue;
    }
    const contactEmail = d.contacts?.email?.trim() ?? "";
    const customerEmail = d.customers?.email?.trim() ?? "";
    const email = EMAIL_RE.test(contactEmail) ? contactEmail : EMAIL_RE.test(customerEmail) ? customerEmail : null;
    byCustomer.set(d.customer_id, {
      customerId: d.customer_id,
      name: d.customers?.name ?? "Advertiser",
      firstName: contactEmail && EMAIL_RE.test(contactEmail) ? (d.contacts?.first_name ?? null) : null,
      email,
      pages: page ? [page] : [],
      ownerEmail: d.owner?.email ?? null,
      ownerName: d.owner?.full_name ?? null,
      orderId: d.id,
      sentAt: sentFor.get(d.customer_id) ?? null,
    });
  }
  for (const r of byCustomer.values()) r.pages = [...new Set(r.pages)].sort((a, b) => a - b);
  return [...byCustomer.values()].sort((a, b) => a.name.localeCompare(b.name, "en-GB", { sensitivity: "base" }));
}

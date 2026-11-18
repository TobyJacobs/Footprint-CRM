import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonDb, getXero, xeroError, xeroKey, type XeroConnection } from "./client";

// Send queued invoices and credit notes to Xero as drafts (see the xero_sync
// migration). Each customer is matched to a Xero contact first: by the Xero
// id saved on the customer, then by name or email, and only created in Xero
// when there's no match. Every attempt is recorded against its job.

type Job = {
  job_id: string;
  kind: "invoice" | "credit_note";
  attempts: number;
  document: { id: string; doc_type: string; number: string; issue_date: string; due_date: string | null; reference: string | null; xero_id: string | null };
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    xero_contact_id: string | null;
    street: string | null;
    city: string | null;
    county: string | null;
    postcode: string | null;
    country: string | null;
  };
  lines: { description: string; quantity: number; unit_price: number; discount_percent: number; tax_rate: number; tax_rate_id: string | null; account_code: string | null }[];
};

// Xero's UK tax types by VAT %, when no match has been chosen in Admin → Xero.
export const defaultSalesTaxType = (rate: number) => (rate >= 19.99 ? "OUTPUT2" : rate >= 4.99 ? "RROUTPUT" : "ZERORATEDOUTPUT");

async function findOrCreateContact(xero: XeroConnection, c: Job["customer"]): Promise<string> {
  if (c.xero_contact_id) {
    const { ok, data } = await xero.call(`Contacts/${encodeURIComponent(c.xero_contact_id)}`);
    const found = ok && (data.Contacts as { ContactStatus?: string }[] | undefined)?.[0];
    if (found && found.ContactStatus !== "ARCHIVED") return c.xero_contact_id;
  }
  // Same name (ignoring capitals), or the same email address.
  const { ok, status, data } = await xero.call(`Contacts?searchTerm=${encodeURIComponent(c.name.slice(0, 100))}&summaryOnly=true`);
  if (!ok) throw new Error(xeroError(status, data));
  const contacts = (data.Contacts as { ContactID: string; Name: string; EmailAddress?: string; ContactStatus?: string }[] | undefined) ?? [];
  const active = contacts.filter((x) => x.ContactStatus !== "ARCHIVED");
  const match =
    active.find((x) => x.Name.trim().toLowerCase() === c.name.trim().toLowerCase()) ??
    (c.email ? active.find((x) => x.EmailAddress?.toLowerCase() === c.email!.toLowerCase()) : undefined);
  if (match) return match.ContactID;

  const contact = {
    Name: c.name.slice(0, 255),
    ...(c.email ? { EmailAddress: c.email } : {}),
    ...(c.phone ? { Phones: [{ PhoneType: "DEFAULT", PhoneNumber: c.phone }] } : {}),
    ...(c.street || c.postcode
      ? { Addresses: [{ AddressType: "POBOX", AddressLine1: c.street ?? "", City: c.city ?? "", Region: c.county ?? "", PostalCode: c.postcode ?? "", Country: c.country ?? "" }] }
      : {}),
  };
  const made = await xero.call("Contacts", { method: "POST", body: JSON.stringify({ Contacts: [contact] }) });
  const id = (made.data.Contacts as { ContactID?: string }[] | undefined)?.[0]?.ContactID;
  if (!made.ok || !id) throw new Error(`Couldn't add the customer to Xero: ${xeroError(made.status, made.data)}`);
  return id;
}

function lineItems(xero: XeroConnection, job: Job) {
  return job.lines.map((l) => ({
    Description: (l.description || "—").slice(0, 4000),
    Quantity: Number(l.quantity),
    UnitAmount: Number(l.unit_price),
    ...(Number(l.discount_percent) > 0 ? { DiscountRate: Number(l.discount_percent) } : {}),
    ...(l.account_code ? { AccountCode: l.account_code } : {}),
    TaxType: (l.tax_rate_id && xero.taxMap[l.tax_rate_id]) || defaultSalesTaxType(Number(l.tax_rate)),
  }));
}

async function sendJob(xero: XeroConnection, job: Job): Promise<{ xeroId: string; xeroNumber: string | null; contactId: string }> {
  const contactId = await findOrCreateContact(xero, job.customer);
  const d = job.document;
  const common = {
    Contact: { ContactID: contactId },
    Date: d.issue_date,
    ...(d.reference ? { Reference: d.reference.slice(0, 255) } : {}),
    Status: "DRAFT",
    LineAmountTypes: "Exclusive",
    CurrencyCode: "GBP",
    LineItems: lineItems(xero, job),
  };
  // A new key per attempt, so a retry after an error isn't answered with the old error.
  const headers = { "Idempotency-Key": `${job.job_id}-${job.attempts}` };
  if (job.kind === "invoice") {
    const body = { Invoices: [{ Type: "ACCREC", ...common, ...(d.due_date ? { DueDate: d.due_date } : {}), ...(xero.useOsNumbers ? { InvoiceNumber: d.number } : {}) }] };
    const { ok, status, data } = await xero.call("Invoices", { method: "POST", body: JSON.stringify(body), headers });
    const inv = (data.Invoices as { InvoiceID?: string; InvoiceNumber?: string; HasErrors?: boolean }[] | undefined)?.[0];
    if (!ok || !inv?.InvoiceID || inv.HasErrors) throw new Error(xeroError(status, data));
    return { xeroId: inv.InvoiceID, xeroNumber: inv.InvoiceNumber ?? null, contactId };
  }
  const body = { CreditNotes: [{ Type: "ACCRECCREDIT", ...common, ...(xero.useOsNumbers ? { CreditNoteNumber: d.number } : {}) }] };
  const { ok, status, data } = await xero.call("CreditNotes", { method: "POST", body: JSON.stringify(body), headers });
  const cn = (data.CreditNotes as { CreditNoteID?: string; CreditNoteNumber?: string; HasErrors?: boolean }[] | undefined)?.[0];
  if (!ok || !cn?.CreditNoteID || cn.HasErrors) throw new Error(xeroError(status, data));
  return { xeroId: cn.CreditNoteID, xeroNumber: cn.CreditNoteNumber ?? null, contactId };
}

// Work through the queue (or just one job). Returns how it went.
export async function runXeroSync(options: { onlyJob?: string; limit?: number; db?: SupabaseClient } = {}) {
  const db = options.db ?? anonDb();
  const xero = await getXero(db);
  if (!xero) return { ok: false, sent: 0, failed: 0, error: "Xero isn't connected" };
  const key = xeroKey();
  const { data, error } = await db.rpc("xero_next_jobs", { p_key: key, p_limit: options.limit ?? 20, p_only: options.onlyJob ?? null });
  if (error) return { ok: false, sent: 0, failed: 0, error: error.message };
  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;
  for (const job of (data ?? []) as Job[]) {
    try {
      const r = await sendJob(xero, job);
      await db.rpc("xero_job_result", { p_key: key, p_job: job.job_id, p_ok: true, p_error: null, p_xero_id: r.xeroId, p_xero_number: r.xeroNumber, p_contact_id: r.contactId });
      sent++;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Unknown error";
      await db.rpc("xero_job_result", { p_key: key, p_job: job.job_id, p_ok: false, p_error: lastError, p_xero_id: null, p_xero_number: null, p_contact_id: null });
      failed++;
      // Xero is rate-limiting us: leave the rest for the next run.
      if (lastError.startsWith("Xero is busy")) break;
    }
  }
  return { ok: failed === 0, sent, failed, error: lastError };
}

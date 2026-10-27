"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { bool, int, num, str } from "@/lib/forms";
import { addDaysTo, addMonthsTo, customerDueDate, ukToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

// Magazines setup: editions, monthly issues and advert sizes. Needs Magazines
// edit; the database checks the same.

const SETUP = "/magazines/setup";

function fail(message: string, month?: string): never {
  redirect(`${SETUP}?${month ? `month=${month}&` : ""}error=${encodeURIComponent(message)}`);
}
function done(month?: string): never {
  revalidatePath("/magazines", "layout");
  redirect(`${SETUP}?${month ? `month=${month}&` : ""}saved=1`);
}

export async function saveEdition(id: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const name = str(fd, "name");
  if (!name) fail("Each edition needs a name");
  const supabase = await createClient();
  const { error } = await supabase
    .from("magazine_editions")
    .update({
      name,
      distribution: int(fd, "distribution"),
      default_pages: int(fd, "default_pages") ?? 56,
      monthly_target: num(fd, "monthly_target"),
      active: bool(fd, "active"),
    })
    .eq("id", id);
  if (error) fail(error.message);
  done();
}

export async function saveIssue(id: string, month: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const supabase = await createClient();
  const { error } = await supabase
    .from("magazine_issues")
    .update({
      pages: int(fd, "pages") ?? 0,
      copy_deadline: str(fd, "copy_deadline"),
      sales_target: num(fd, "sales_target"),
      complete: bool(fd, "complete"),
    })
    .eq("id", id);
  if (error) fail(error.message, month);
  done(month);
}

// Add the next 12 months of issues for every active edition (skipping any
// that exist), using each edition's usual pages and target.
export async function addIssueMonths(fd: FormData) {
  await requirePermission("magazines", "edit");
  const from = str(fd, "from");
  if (!from || !/^\d{4}-\d{2}$/.test(from)) fail("Choose the first month to add");
  const supabase = await createClient();
  const { data: editions, error: readError } = await supabase
    .from("magazine_editions")
    .select("id, default_pages, monthly_target")
    .eq("active", true);
  if (readError) fail(readError.message);
  const rows = (editions ?? []).flatMap((e) =>
    Array.from({ length: 12 }, (_, i) => ({
      edition_id: e.id,
      month: `${addMonthsTo(from, i)}-01`,
      pages: e.default_pages,
      sales_target: e.monthly_target,
    })),
  );
  const { error } = await supabase.from("magazine_issues").upsert(rows, { onConflict: "edition_id,month", ignoreDuplicates: true });
  if (error) fail(error.message, from);
  done(from);
}

export async function saveAdvertSize(id: string, fd: FormData) {
  await requirePermission("magazines", "edit");
  const fraction = num(fd, "page_fraction");
  if (!fraction || fraction <= 0 || fraction > 4) fail("Part of a page must be between 0 and 4 (e.g. 0.25 for a quarter)");
  const supabase = await createClient();
  const { error } = await supabase
    .from("advert_sizes")
    .update({
      width_mm: num(fd, "width_mm"),
      height_mm: num(fd, "height_mm"),
      page_fraction: fraction,
      default_price: num(fd, "default_price"),
      active: bool(fd, "active"),
    })
    .eq("id", id);
  if (error) fail(error.message);
  done();
}

// Invoicing issue by issue (Wave 5, part 2): one draft invoice per sales order
// for its adverts in this month, not yet billed. Each customer's own payment
// terms set the due date. The database makes sure nothing is billed twice.
export async function invoiceMagazineMonth(month: string) {
  await requirePermission("quotes", "edit");
  await requirePermission("magazines", "view");
  const back = (q: string) => redirect(`/magazines?month=${month}&${q}`);
  if (!/^\d{4}-\d{2}$/.test(month)) back("error=Unknown month");
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("magazine_month_bookings", { p_month: `${month}-01` });
  if (error) back(`error=${encodeURIComponent(error.message)}`);
  const orderIds = [
    ...new Set(
      ((rows ?? []) as { doc_type: string; status: string; invoice_id: string | null; document_id: string }[])
        .filter((r) => r.doc_type === "sales_order" && ["open", "completed"].includes(r.status) && !r.invoice_id)
        .map((r) => r.document_id),
    ),
  ];
  if (orderIds.length === 0) back("error=Nothing left to invoice for this month");

  const [{ data: orders }, { data: settings }] = await Promise.all([
    supabase.from("sales_documents").select("id, customers!sales_documents_customer_id_fkey(invoice_due_days, invoice_due_terms)").in("id", orderIds),
    supabase.from("company_settings").select("invoice_due_days").single(),
  ]);
  const today = ukToday();
  let made = 0;
  const problems: string[] = [];
  for (const o of orders ?? []) {
    const c = o.customers as unknown as { invoice_due_days: number | null; invoice_due_terms: string | null } | null;
    const due = customerDueDate(today, c?.invoice_due_days, c?.invoice_due_terms) ?? addDaysTo(today, settings?.invoice_due_days ?? 30);
    const { data: invoiceId, error: invError } = await supabase.rpc("magazine_invoice_order", { p_order: o.id, p_month: `${month}-01`, p_due: due });
    if (invError) problems.push(invError.message);
    else if (invoiceId) made++;
  }
  revalidatePath("/magazines", "layout");
  revalidatePath("/sales", "layout");
  back(`invoiced=${made}${problems.length ? `&error=${encodeURIComponent(`${problems.length} couldn't be invoiced: ${problems[0]}`)}` : ""}`);
}

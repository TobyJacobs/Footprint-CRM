"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { bool, int, num, str } from "@/lib/forms";
import { addMonthsTo } from "@/lib/dates";
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

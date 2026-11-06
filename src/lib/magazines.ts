import "server-only";
import type { RateRow } from "@/lib/magazine-options";
import { createClient } from "@/lib/supabase/server";

// Forget Me Not: editions, monthly issues and advert sizes (Wave 5, part 1).
// An advert is a quote / sales order line tagged with its issue and size.

export type Edition = {
  id: string;
  code: string;
  name: string;
  format: string;
  distribution: number | null;
  default_pages: number;
  monthly_target: number | null;
  active: boolean;
};

export type Issue = {
  id: string;
  edition_id: string;
  month: string;
  pages: number;
  copy_deadline: string | null;
  sales_target: number | null;
  complete: boolean;
};

export type AdvertSize = {
  id: string;
  name: string;
  width_mm: number | null;
  height_mm: number | null;
  page_fraction: number;
  default_price: number | null;
  position: number;
  active: boolean;
};

// What the advert builder on a quote needs: active editions and sizes, and
// the issues from this month on.
export type AdvertSetup = {
  editions: Pick<Edition, "id" | "code" | "name">[];
  issues: Pick<Issue, "id" | "edition_id" | "month" | "complete">[];
  sizes: (Pick<AdvertSize, "id" | "name" | "width_mm" | "height_mm" | "default_price"> & { rate_product: string | null })[];
  sections: { id: string; name: string }[];
  // The rate card (all years), for pricing adverts automatically.
  rates: RateRow[];
};

export const editionLabel = (e: { code: string; name: string }) => `${e.code}. ${e.name}`;

export const monthLabel = (month: string) =>
  new Date(`${month.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export async function getAdvertSetup(fromMonth: string): Promise<AdvertSetup> {
  const supabase = await createClient();
  const [{ data: editions }, { data: issues }, { data: sizes }, { data: sections }, { data: rates }] = await Promise.all([
    supabase.from("magazine_editions").select("id, code, name").eq("active", true).order("code"),
    supabase.from("magazine_issues").select("id, edition_id, month, complete").gte("month", `${fromMonth.slice(0, 7)}-01`).order("month"),
    supabase.from("advert_sizes").select("id, name, width_mm, height_mm, default_price, rate_product").eq("active", true).order("position"),
    supabase.from("magazine_sections").select("id, name").eq("active", true).order("position").order("name"),
    supabase.from("magazine_rates").select("year, product, term, area, price"),
  ]);
  return {
    editions: (editions ?? []) as AdvertSetup["editions"],
    issues: (issues ?? []) as AdvertSetup["issues"],
    sizes: (sizes ?? []).map((s) => ({
      ...s,
      width_mm: s.width_mm === null ? null : Number(s.width_mm),
      height_mm: s.height_mm === null ? null : Number(s.height_mm),
      default_price: s.default_price === null ? null : Number(s.default_price),
    })) as AdvertSetup["sizes"],
    sections: (sections ?? []) as AdvertSetup["sections"],
    rates: ((rates ?? []) as RateRow[]).map((r) => ({ ...r, price: Number(r.price) })),
  };
}

// The first advert month on a quote or order, and that month's copy deadlines
// (for the deposit rule in lib/magazine-deposit). Null if it has no adverts.
export async function getAdvertTiming(documentId: string): Promise<{ firstMonth: string; deadlines: (string | null)[] } | null> {
  const supabase = await createClient();
  const { data: lines } = await supabase.from("sales_document_lines").select("magazine_issue_id").eq("document_id", documentId).not("magazine_issue_id", "is", null);
  const ids = [...new Set((lines ?? []).map((l) => l.magazine_issue_id as string))];
  if (!ids.length) return null;
  const { data: issues } = await supabase.from("magazine_issues").select("month, copy_deadline").in("id", ids);
  if (!issues?.length) return null;
  const firstMonth = issues.map((i) => i.month as string).sort()[0];
  return { firstMonth, deadlines: issues.filter((i) => i.month === firstMonth).map((i) => i.copy_deadline as string | null) };
}

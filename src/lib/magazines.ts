import "server-only";
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
  sizes: Pick<AdvertSize, "id" | "name" | "width_mm" | "height_mm" | "default_price">[];
};

export const editionLabel = (e: { code: string; name: string }) => `${e.code}. ${e.name}`;

export const monthLabel = (month: string) =>
  new Date(`${month.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export async function getAdvertSetup(fromMonth: string): Promise<AdvertSetup> {
  const supabase = await createClient();
  const [{ data: editions }, { data: issues }, { data: sizes }] = await Promise.all([
    supabase.from("magazine_editions").select("id, code, name").eq("active", true).order("code"),
    supabase.from("magazine_issues").select("id, edition_id, month, complete").gte("month", `${fromMonth.slice(0, 7)}-01`).order("month"),
    supabase.from("advert_sizes").select("id, name, width_mm, height_mm, default_price").eq("active", true).order("position"),
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
  };
}

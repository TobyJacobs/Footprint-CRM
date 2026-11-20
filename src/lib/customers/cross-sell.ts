import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ukToday } from "@/lib/dates";
import { services } from "./options";

// Cross-sell (owner, 20 November 2026): Footprint's services (the customer's
// "Service Stack" list), each marked as one they buy or an opportunity.
// A service counts as bought when it's ticked in the Service Stack, or when an
// order or invoice shows it (see serviceOf), or they have a hosting plan
// (Web) or a retainer (Digital Marketing). Someone can mark an opportunity
// "Not interested" so it stops being suggested.

export type Service = (typeof services)[number];

export type CrossSellRow = {
  service: Service;
  ticked: boolean; // in the Service Stack
  spend: number; // invoiced, before VAT
  lastDate: string | null; // last order or invoice showing it
  lastDoc: { id: string; number: string } | null;
  other: string | null; // e.g. "Hosting plan"
  lapsed: boolean; // bought, but nothing for over 12 months
  dismissed: { reason: string | null; at: string } | null;
};

export type CrossSell = { rows: CrossSellRow[]; buying: number; opportunities: number };

// Which service a line is for: the product's category, then the document's
// or product's business unit, then words in the line's description.
const byCategory: [RegExp, Service][] = [
  [/^(website|hosting)$/i, "Web"],
  [/^(digital marketing|email marketing)$/i, "Digital Marketing"],
  [/^social media$/i, "Social"],
  [/^(ylk|platform)/i, "YLK"],
];
const byWords: [RegExp, Service][] = [
  [/\b(vehicle|van|livery|wrap|chapter ?8|fleet graphics)\b/i, "Vehicle Graphics"],
  [/\b(sign|signs|signage|banner|banners|pull[- ]?up|roller|correx|dibond|foamex|hoarding|a[- ]?board|window graphics?|vinyl)\b/i, "Signage"],
  [/\b(mug|mugs|pen|pens|t-?shirts?|hoodies?|polo|caps?|tote|lanyards?|keyrings?|merch|merchandise|embroider\w*|branded clothing|workwear|water bottles?)\b/i, "Merchandise"],
  [/\b(website|web ?site|hosting|domain|landing page|microsite|seo)\b/i, "Web"],
  [/\b(social media|instagram|facebook|tiktok)\b/i, "Social"],
  [/\b(paid ads|ppc|google ads|email marketing|digital marketing)\b/i, "Digital Marketing"],
  [/\b(lead kit|ylk)\b/i, "YLK"],
  [/\b(advert|advertis\w*|forget me not|fmn|full page|half page|quarter page)\b/i, "Advertising"],
  [/\b(leaflets?|flyers?|business cards?|brochures?|posters?|booklets?|letterheads?|compliment slips?|stickers?|labels?|postcards?|menus?|calendars?|folders?|ncr|printed|printing|print)\b/i, "Print"],
];

type Line = {
  description: string;
  line_net: number;
  magazine_issue_id: string | null;
  products: { category: string | null; business_unit: string | null } | null;
};

export function serviceOf(line: Line, docUnit: string | null): Service | null {
  if (line.magazine_issue_id) return "Advertising";
  const cat = line.products?.category?.trim();
  if (cat) for (const [re, s] of byCategory) if (re.test(cat)) return s;
  if (docUnit === "Advertising" || docUnit === "Account Sales") return "Advertising";
  if (docUnit === "Signage") return "Signage";
  if (docUnit === "Digital") return "Digital Marketing";
  for (const [re, s] of byWords) if (re.test(line.description ?? "")) return s;
  if (docUnit === "Print" || docUnit === "Print/Merch" || line.products?.business_unit === "Print") return "Print";
  return null;
}

type Doc = {
  id: string;
  number: string;
  doc_type: string;
  status: string;
  issue_date: string;
  business_unit: string | null;
  sales_document_lines: Line[] | null;
};

// They buy it: ticked, ordered, or a hosting plan or retainer.
export const buysService = (r: CrossSellRow) => r.ticked || !!r.lastDate || !!r.other;

const round = (n: number) => Math.round(n * 100) / 100;

export function summariseCrossSell(input: {
  ticked: string[];
  docs: Doc[];
  hostingPlans: number;
  retainers: number;
  dismissed: { service: string; reason: string | null; created_at: string }[];
  today?: string;
}): CrossSell {
  const today = input.today ?? ukToday();
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const seen = new Map<Service, { spend: number; lastDate: string | null; lastDoc: CrossSellRow["lastDoc"] }>();
  for (const d of input.docs) {
    for (const l of d.sales_document_lines ?? []) {
      const s = serviceOf(l, d.business_unit);
      if (!s) continue;
      const e = seen.get(s) ?? { spend: 0, lastDate: null, lastDoc: null };
      if (d.doc_type === "invoice") e.spend += Number(l.line_net) || 0;
      if (!e.lastDate || d.issue_date > e.lastDate) {
        e.lastDate = d.issue_date;
        e.lastDoc = { id: d.id, number: d.number };
      }
      seen.set(s, e);
    }
  }
  const rows: CrossSellRow[] = services.map((service) => {
    const e = seen.get(service);
    const other = service === "Web" && input.hostingPlans ? "Hosting plan" : service === "Digital Marketing" && input.retainers ? "Retainer" : null;
    const d = input.dismissed.find((x) => x.service === service);
    return {
      service,
      ticked: input.ticked.includes(service),
      spend: round(e?.spend ?? 0),
      lastDate: e?.lastDate ?? null,
      lastDoc: e?.lastDoc ?? null,
      other,
      // Only from orders: a ticked service or a live plan isn't "lapsed".
      lapsed: !!e?.lastDate && e.lastDate < yearAgo && !other,
      dismissed: d ? { reason: d.reason, at: d.created_at } : null,
    };
  });
  return {
    rows,
    buying: rows.filter(buysService).length,
    opportunities: rows.filter((r) => !buysService(r) && !r.dismissed).length,
  };
}

export async function loadCrossSell(supabase: SupabaseClient, customerId: string, ticked: string[]): Promise<CrossSell> {
  const [docs, hosting, retainers, dismissed] = await Promise.all([
    supabase
      .from("sales_documents")
      .select(
        "id, number, doc_type, status, issue_date, business_unit, sales_document_lines!sales_document_lines_document_id_fkey(description, line_net, magazine_issue_id, products(category, business_unit))",
      )
      .eq("customer_id", customerId)
      .in("doc_type", ["sales_order", "invoice"])
      .not("status", "in", "(draft,cancelled,void)")
      .order("issue_date", { ascending: false })
      .limit(500),
    supabase.from("hosting_plans").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
    supabase.from("retainers").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
    supabase.from("customer_cross_sell_dismissals").select("service, reason, created_at").eq("customer_id", customerId),
  ]);
  if (docs.error) console.error("Cross-sell: documents", docs.error.message);
  if (dismissed.error) console.error("Cross-sell: not interested", dismissed.error.message);
  return summariseCrossSell({
    ticked,
    docs: (docs.data ?? []) as unknown as Doc[],
    hostingPlans: hosting.count ?? 0,
    retainers: retainers.count ?? 0,
    dismissed: dismissed.data ?? [],
  });
}

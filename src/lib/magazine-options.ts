// Premium positions an advert can have (the database only accepts these).
// Kept apart from lib/magazines (server only) so the advert form can use it.
export const premiumPositions = ["Front cover", "Back cover", "Inside front cover", "Inside back cover", "First page", "Centre spread", "Facing editorial"] as const;

// The rate-card product a premium position is priced as (Facing editorial
// has no rate-card price).
export const premiumRateProduct: Record<string, string> = {
  "Front cover": "front",
  "Back cover": "back",
  "Inside front cover": "inside",
  "Inside back cover": "inside",
  "First page": "page3",
  "Centre spread": "centre",
};

export type RateRow = { year: number; product: string; term: "short" | "long"; area: number; price: number };

// The rate-card price per month for one edition: 6+ months is the long rate;
// the 1st to 5th area booked each have their own price, then the 5th's.
// Uses the latest rate card for the issue's year (or the latest before it).
// Rounded to whole pounds (half up), as the website calculator and the sales
// spreadsheet do (Huw, 6 November 2026).
export function ratePrice(rates: RateRow[], product: string | null | undefined, months: number, areaIndex: number, year: number): number | null {
  if (!product) return null;
  const term = months >= 6 ? "long" : "short";
  const area = Math.min(Math.max(areaIndex, 1), 5);
  const years = [...new Set(rates.filter((r) => r.product === product).map((r) => r.year))].sort((a, b) => b - a);
  const useYear = years.find((y) => y <= year) ?? years[years.length - 1];
  const hit = rates.find((r) => r.year === useYear && r.product === product && r.term === term && r.area === area);
  return hit ? Math.round(Number(hit.price)) : null;
}

// A flatplan page's area in mm (the Full Page advert size).
export const PAGE_W = 130;
export const PAGE_H = 190;

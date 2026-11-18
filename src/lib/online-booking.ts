// Online advert booking (owner, 18 November 2026): the choices, live prices
// and availability for the public booking page. Used by the page (so prices
// update as the customer chooses) and again by the server when they send it
// (so nothing the browser says about prices is trusted). Kept apart from the
// database so it can be checked on its own.
import { premiumRateProduct, ratePrice, type RateRow } from "./magazine-options";

// The id the page's anti-spam time stamp is signed with.
export const BOOKING_STAMP_ID = "advertbooking";

export type BookingSetup = {
  editions: { id: string; code: string; name: string; distribution: number | null }[];
  sizes: { id: string; name: string; width_mm: number; height_mm: number; page_fraction: number; rate_product: string }[];
  rates: RateRow[];
  issues: { id: string; edition_id: string; month: string; pages: number; complete: boolean; booked_pages: number; taken: string[] }[];
};

// What the customer can book: each advert size, plus the premium positions
// that have a rate-card price (they take a full page, or two for the centre).
export type BookingOption = { key: string; label: string; sizeId: string; product: string; fraction: number; premium: string | null; note: string };

export const PREMIUM_CHOICES: { premium: string; label: string; pages: 1 | 2 }[] = [
  { premium: "Front cover", label: "Front cover", pages: 1 },
  { premium: "Back cover", label: "Back cover", pages: 1 },
  { premium: "Inside front cover", label: "Inside front cover", pages: 1 },
  { premium: "Inside back cover", label: "Inside back cover", pages: 1 },
  { premium: "First page", label: "Page 3 (first page)", pages: 1 },
  { premium: "Centre spread", label: "Centre spread", pages: 2 },
];

export function bookingOptions(setup: BookingSetup): BookingOption[] {
  const sizes = setup.sizes.map((s) => ({
    key: `size:${s.id}`,
    label: s.name,
    sizeId: s.id,
    product: s.rate_product,
    fraction: Number(s.page_fraction),
    premium: null,
    note: `${Number(s.width_mm)} × ${Number(s.height_mm)} mm`,
  }));
  const full = setup.sizes.find((s) => Number(s.page_fraction) === 1);
  const spread = setup.sizes.find((s) => Number(s.page_fraction) === 2);
  const premium = PREMIUM_CHOICES.flatMap((p) => {
    const size = p.pages === 2 ? spread : full;
    const product = premiumRateProduct[p.premium];
    if (!size || !product || !setup.rates.some((r) => r.product === product)) return [];
    return [{ key: `premium:${p.premium}`, label: p.label, sizeId: size.id, product, fraction: p.pages, premium: p.premium, note: "Premium position" }];
  });
  return [...sizes, ...premium];
}

export type BookingChoice = { editionIds: string[]; optionKey: string; months: number; start: string /* YYYY-MM */ };
export const MONTH_CHOICES = [1, 3, 6, 12] as const;

const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
export const monthName = (ym: string) =>
  new Date(`${ym.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export type Availability = "available" | "limited" | "full" | "taken" | "closed" | "not_open";
export const availabilityLabel: Record<Availability, string> = {
  available: "Available",
  limited: "Limited space",
  full: "Full",
  taken: "Taken",
  closed: "Closed",
  not_open: "Not open yet",
};
const rank: Availability[] = ["available", "limited", "not_open", "closed", "full", "taken"];
export const canBook = (a: Availability) => a === "available" || a === "limited";

export type BookingLine = { issue_id: string; advert_size_id: string; premium_position: string | null; description: string; unit_price: number };

// Every line (one per edition per month), its price, and each edition's
// worst availability over the months chosen.
export function planBooking(setup: BookingSetup, choice: BookingChoice) {
  const option = bookingOptions(setup).find((o) => o.key === choice.optionKey) ?? null;
  const editions = choice.editionIds.map((id) => setup.editions.find((e) => e.id === id)).filter((e): e is BookingSetup["editions"][number] => !!e);
  const months = Array.from({ length: Math.max(0, Math.min(24, choice.months)) }, (_, i) => addMonths(choice.start, i));
  const lines: BookingLine[] = [];
  const perEdition: { edition: BookingSetup["editions"][number]; status: Availability; months: { month: string; status: Availability }[] }[] = [];
  let missingPrice = false;

  for (const [index, e] of editions.entries()) {
    const statuses: { month: string; status: Availability }[] = [];
    for (const ym of months) {
      const issue = setup.issues.find((i) => i.edition_id === e.id && i.month.slice(0, 7) === ym);
      let status: Availability;
      if (!issue) status = "not_open";
      else if (issue.complete) status = "closed";
      else if (option?.premium) status = issue.taken.includes(option.premium) ? "taken" : "available";
      else {
        const left = Number(issue.pages) - Number(issue.booked_pages);
        const need = option?.fraction ?? 0;
        status = Number(issue.pages) > 0 && left < need ? "full" : Number(issue.pages) > 0 && left - need < 1 ? "limited" : "available";
      }
      statuses.push({ month: ym, status });
      if (option && issue) {
        const price = ratePrice(setup.rates, option.product, choice.months, index + 1, Number(ym.slice(0, 4)));
        if (price === null) missingPrice = true;
        lines.push({
          issue_id: issue.id,
          advert_size_id: option.sizeId,
          premium_position: option.premium,
          description: `${option.label} advert – Forget Me Not ${e.code}. ${e.name} – ${monthName(ym)}`,
          unit_price: price ?? 0,
        });
      }
    }
    const worst = statuses.reduce<Availability>((w, s) => (rank.indexOf(s.status) > rank.indexOf(w) ? s.status : w), "available");
    perEdition.push({ edition: e, status: worst, months: statuses });
  }

  // The first month's cost (later months are the same unless the rate card year changes).
  const firstIssues = new Set(setup.issues.filter((i) => i.month.slice(0, 7) === months[0]).map((i) => i.id));
  const perMonth = Math.round(lines.filter((l) => firstIssues.has(l.issue_id)).reduce((s, l) => s + l.unit_price, 0) * 100) / 100;
  const total = Math.round(lines.reduce((s, l) => s + l.unit_price, 0) * 100) / 100;
  const ok = !!option && editions.length > 0 && months.length > 0 && !missingPrice && perEdition.every((p) => canBook(p.status)) && lines.length === editions.length * months.length;
  return { option, editions, months, lines, perEdition, perMonth, total, vat: Math.round(total * 0.2 * 100) / 100, missingPrice, ok };
}

// Start months the page offers: the months that have issues, from next month.
export function startMonths(setup: BookingSetup) {
  return [...new Set(setup.issues.map((i) => i.month.slice(0, 7)))].sort();
}

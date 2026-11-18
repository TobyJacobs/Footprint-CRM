// Sales commission (Jack Burton's rules, 16 November 2026): shared helpers for
// the report and the targets page. The figures live in the database.

export type CommissionRow = {
  id: string;
  label: string;
  measure: "revenue" | "gp";
  scope: "own" | "group";
  business_units: string[];
  target: number;
  payout: "percent" | "fixed";
  person: string;
  has_login: boolean;
  actual: number;
  reached: number;
  band: number | null;
  band_amount: number | null;
  commission: number;
  next_band: number | null;
  to_next: number | null;
};

export const measureText = (r: Pick<CommissionRow, "measure" | "scope" | "business_units">) =>
  `${r.scope === "group" ? "Whole group " : ""}${r.measure === "gp" ? "GP" : "revenue"}${r.business_units.length ? ` · ${r.business_units.join(", ")}` : ""}`;

// The business areas a target can count (quote/order business areas).
export const commissionAreas = ["Print/Merch", "Print", "Digital", "Signage", "Advertising", "Footprint AI", "Account Sales"];

// Bands typed one per line as "threshold = amount", e.g. "100 = 10" (10% at
// 100% of target) or "100 = 1950" (a £1,950 bonus). Returns null if any line
// can't be read.
export function parseBands(text: string): { threshold: number; amount: number }[] | null {
  const out: { threshold: number; amount: number }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/[%£,\s]/g, "");
    if (!line) continue;
    const m = /^(\d+(?:\.\d+)?)=(\d+(?:\.\d+)?)$/.exec(line);
    if (!m) return null;
    const threshold = Number(m[1]);
    const amount = Number(m[2]);
    if (!(threshold > 0 && threshold <= 1000) || !(amount >= 0)) return null;
    if (out.some((b) => b.threshold === threshold)) return null;
    out.push({ threshold, amount });
  }
  return out.sort((a, b) => a.threshold - b.threshold);
}

export const bandsText = (bands: { threshold: number; amount: number }[]) =>
  bands
    .slice()
    .sort((a, b) => a.threshold - b.threshold)
    .map((b) => `${Number(b.threshold)} = ${Number(b.amount)}`)
    .join("\n");

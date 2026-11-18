// Account managers per area (DJ, 9 November 2026): besides the main account
// manager (the customer's owner), one person may look after each area.
export const accountAreas = ["Advertising", "Marketing", "Print/Merch", "Signage", "Footprint AI"] as const;
export type AccountArea = (typeof accountAreas)[number];
export const isAccountArea = (v: string): v is AccountArea => (accountAreas as readonly string[]).includes(v);

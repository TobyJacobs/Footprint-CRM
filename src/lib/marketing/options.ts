// Shared lists and helpers for the Marketing workspace.

type Tone = "grey" | "teal" | "pink" | "amber" | "red";

export const contentChannels = [
  "Facebook",
  "Instagram",
  "LinkedIn",
  "TikTok",
  "X",
  "YouTube",
  "Google Business",
  "Blog",
  "Email",
  "Website",
  "Video",
  "Other",
] as const;

export const contentStatuses = [
  { value: "idea", label: "Idea" },
  { value: "drafting", label: "Drafting" },
  { value: "client_approval", label: "Client approval" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
] as const;

export const contentStatusLabel = (s: string) => contentStatuses.find((x) => x.value === s)?.label ?? s;

export function contentTone(s: string): Tone {
  if (s === "published") return "teal";
  if (s === "scheduled") return "pink";
  if (s === "client_approval") return "amber";
  return "grey";
}

export const adPlatforms = ["Google", "Meta", "LinkedIn", "TikTok", "Microsoft", "Other"] as const;

export const campaignStatuses = [
  { value: "planned", label: "Planned" },
  { value: "live", label: "Live" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
] as const;

export const campaignStatusLabel = (s: string) => campaignStatuses.find((x) => x.value === s)?.label ?? s;

export function campaignTone(s: string): Tone {
  if (s === "live") return "teal";
  if (s === "paused") return "amber";
  if (s === "planned") return "pink";
  return "grey";
}

// Months are handled as "YYYY-MM" text.
export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { first: `${month}-01`, last: `${month}-${String(last).padStart(2, "0")}`, days: last };
}

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(`${month}-15T12:00:00`));

// How far through a campaign we are (0–1), by its dates. Null without both dates.
export function campaignTimeUsed(start: string | null, end: string | null, today: string): number | null {
  if (!start || !end) return null;
  const s = new Date(`${start}T12:00:00`).getTime();
  const e = new Date(`${end}T12:00:00`).getTime();
  const t = new Date(`${today}T12:00:00`).getTime();
  if (t <= s) return 0;
  if (t >= e) return 1;
  return (t - s) / (e - s);
}

// "Ahead" when more than 10 percentage points of the budget has gone than of
// the time; "over" once spend passes the budget.
export function spendPace(spend: number, budget: number | null, timeUsed: number | null): "over" | "ahead" | "ok" | null {
  if (!budget || budget <= 0) return null;
  if (spend > budget) return "over";
  if (timeUsed !== null && spend / budget > timeUsed + 0.1) return "ahead";
  return "ok";
}

// Retainer services whose monthly quantity is delivered through the content
// calendar (the rest, like ads, are tracked as campaigns).
export const contentServices = ["Social Media Content", "Blog Posts", "Case Studies", "Email Marketing"] as const;

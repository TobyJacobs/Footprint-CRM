// Shared lists and helpers for Projects & Time.

export const projectStatuses = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const taskStatuses = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

export const projectStatusLabel = (s: string) => projectStatuses.find((x) => x.value === s)?.label ?? s;
export const taskStatusLabel = (s: string) => taskStatuses.find((x) => x.value === s)?.label ?? s;

export function projectTone(s: string): "grey" | "teal" | "pink" | "amber" | "red" {
  if (s === "active") return "teal";
  if (s === "on_hold") return "amber";
  if (s === "cancelled") return "red";
  return "grey";
}

// Dates are handled as plain YYYY-MM-DD text, so time zones never shift a day.
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayIso = () => iso(new Date());

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
}

// The Monday of the week containing the given date.
export function weekStart(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return iso(d);
}

export const isDateIso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const hoursText = (n: number) => `${Math.round(n * 100) / 100}h`;

export function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

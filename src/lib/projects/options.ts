// Shared lists and helpers for Projects & Time.

export const projectStatuses = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const taskStatuses = [
  { value: "open", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

export const projectGroups = ["Swindon – Production", "Swindon – Studio", "Web Project", "Marketing Retained"] as const;

export const projectStatusLabel = (s: string) => projectStatuses.find((x) => x.value === s)?.label ?? s;
export const taskStatusLabel = (s: string) => taskStatuses.find((x) => x.value === s)?.label ?? s;

export function projectTone(s: string): "grey" | "teal" | "pink" | "amber" | "red" {
  if (s === "active") return "teal";
  if (s === "on_hold") return "amber";
  if (s === "cancelled") return "red";
  return "grey";
}

export const isOpenProject = (s: string) => s === "active" || s === "on_hold";

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

// Time is stored in minutes; shown as e.g. "1h 30m".
export function minutesText(total: number) {
  const m = Math.round(total);
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

export function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

// Estimates are typed in as hours (e.g. 1.5) and stored as minutes.
export const minutesToHours = (m: number | null | undefined) => (m === null || m === undefined ? "" : String(Math.round((m / 60) * 100) / 100));

// The pipeline groups each project by the stage of its first unfinished task.
export const PIPELINE_NO_TASKS = "No tasks yet";
export const PIPELINE_ALL_DONE = "All tasks done";

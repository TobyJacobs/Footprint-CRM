// Small helpers for showing customer data consistently.

export function statusTone(status: string | null) {
  if (status === "Client Active" || status === "Active" || status === "Live") return "teal" as const;
  if (status === "Cancelled Services" || status === "Cancelled" || status?.startsWith("Client Not Active")) return "red" as const;
  if (status === "Client Information Update Required" || status === "Paused") return "amber" as const;
  return "grey" as const;
}

export function personName(p: { salutation?: string | null; first_name?: string | null; last_name: string }) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ");
}

export function address(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(", ");
}

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
export function gbp(n: number | null | undefined) {
  return n === null || n === undefined ? null : money.format(n);
}

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
const dayTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });
export function longDate(d: string | null | undefined) {
  return d ? day.format(new Date(d)) : null;
}
export function shortDateTime(d: string | null | undefined) {
  return d ? dayTime.format(new Date(d)) : null;
}

// Value for <input type="datetime-local"> in UK time.
export function toLocalInput(d: string | null | undefined) {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(d));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

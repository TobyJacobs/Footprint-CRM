// Helpers for reading submitted form fields into tidy values.
// Empty text becomes null, so blank fields don't store "".

export function str(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function num(fd: FormData, name: string): number | null {
  const v = str(fd, name);
  if (v === null) return null;
  const n = Number(v.replace(/[£,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function int(fd: FormData, name: string): number | null {
  const n = num(fd, name);
  return n === null ? null : Math.round(n);
}

export function bool(fd: FormData, name: string): boolean {
  return fd.get(name) === "on";
}

export function list(fd: FormData, name: string): string[] {
  return fd
    .getAll(name)
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

// How far UK clocks are ahead of UTC at a moment (0, or 1 hour in summer).
function londonOffsetMs(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")) - (ms - (ms % 1000));
}

// <input type="datetime-local"> gives UK wall-clock time with no zone. The
// server runs on UTC, so read it as UK time explicitly (otherwise it moves an
// hour every save in British Summer Time).
export function dateTime(fd: FormData, name: string): string | null {
  const v = str(fd, name);
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  // Check the offset again at the answer, in case the clocks change in between.
  let ms = wall - londonOffsetMs(wall);
  ms = wall - londonOffsetMs(ms);
  return new Date(ms).toISOString();
}

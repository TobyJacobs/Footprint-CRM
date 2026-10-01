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

// <input type="datetime-local"> gives local time; store it as a full timestamp.
export function dateTime(fd: FormData, name: string): string | null {
  const v = str(fd, name);
  return v ? new Date(v).toISOString() : null;
}

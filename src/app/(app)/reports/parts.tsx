import Link from "next/link";
import { Download } from "lucide-react";
import { inputClass, secondaryButton } from "@/components/ui";
import { presets, type Period } from "@/lib/reports";

// The date range picker (a plain form, so the choice is in the page address
// and can be bookmarked or shared). Extra filters are kept as they are.
export function PeriodPicker({ period, keep = {} }: { period: Period; keep?: Record<string, string> }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
      {Object.entries(keep).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-fp-mid">Period</span>
        <select name="period" defaultValue={period.preset} className={`${inputClass} w-auto`}>
          {presets.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-fp-mid">From (if choosing dates)</span>
        <input type="date" name="from" defaultValue={period.from} className={`${inputClass} w-auto`} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-fp-mid">To</span>
        <input type="date" name="to" defaultValue={period.to} className={`${inputClass} w-auto`} />
      </label>
      <button type="submit" className={secondaryButton}>
        Show
      </button>
    </form>
  );
}

export function CsvLink({ href }: { href: string }) {
  return (
    <Link href={href} prefetch={false} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
      <Download size={14} aria-hidden /> Download CSV
    </Link>
  );
}

export function Change({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-fp-mid">—</span>;
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  return <span className={pct >= 0 ? "text-fp-teal-deep" : "text-fp-error"}>{`${pct > 0 ? "+" : ""}${pct}%`}</span>;
}

export const th = "px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-wider text-fp-mid";
export const td = "px-3 py-2";
export const num = "px-3 py-2 text-right tabular-nums";

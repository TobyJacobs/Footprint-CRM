"use client";

// "Open all / Close all" for the wave rows on the roadmap.
export default function ExpandAll() {
  const setAll = (open: boolean) =>
    document.querySelectorAll<HTMLDetailsElement>("details[data-wave]").forEach((d) => (d.open = open));
  const btn = "text-sm font-semibold text-fp-teal-deep hover:underline";
  return (
    <div className="flex gap-4">
      <button type="button" onClick={() => setAll(true)} className={btn}>
        Open all
      </button>
      <button type="button" onClick={() => setAll(false)} className={btn}>
        Close all
      </button>
    </div>
  );
}

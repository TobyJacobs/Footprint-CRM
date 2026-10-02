"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Period and salesperson pickers for the charts. Changing one reloads the
// figures straight away.
export default function ChartFilters({
  months,
  owner,
  people,
}: {
  months: number;
  owner: string;
  people: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const select = "rounded-md border border-fp-border bg-white px-2 py-1.5 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-fp-dark/75">Period</span>
        <select className={select} value={String(months)} onChange={(e) => update("months", e.target.value)}>
          <option value="3">Last 3 months</option>
          <option value="6">Last 6 months</option>
          <option value="12">Last 12 months</option>
          <option value="24">Last 24 months</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-fp-dark/75">Salesperson</span>
        <select className={select} value={owner} onChange={(e) => update("owner", e.target.value)}>
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

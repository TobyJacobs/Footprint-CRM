import { dashboardTypes } from "@/lib/dashboards/data";
import { inputClass } from "../ui";

// Which home page a role gets. New roles added later just pick one of these.
export default function DashboardSelect({ value, ownOnly }: { value?: string | null; ownOnly?: boolean | null }) {
  return (
    <>
    <label className="grid gap-1 text-sm">
      <span className="font-semibold">Home page dashboard</span>
      <select name="dashboard" defaultValue={value ?? "general"} className={inputClass}>
        {dashboardTypes.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}: {d.description}
          </option>
        ))}
      </select>
    </label>
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name="own_records_only" defaultChecked={ownOnly ?? false} className="mt-0.5 accent-fp-pink" />
      <span>
        <span className="font-semibold">Only their own quotes, orders and invoices</span>
        <span className="block text-fp-dark/70">
          People with this role only see documents where they&apos;re the salesperson (unless another of their roles lets
          them see everything).
        </span>
      </span>
    </label>
    </>
  );
}

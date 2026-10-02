import { dashboardTypes } from "@/lib/dashboards/data";
import { inputClass } from "../ui";

// Which home page a role gets. New roles added later just pick one of these.
export default function DashboardSelect({ value }: { value?: string | null }) {
  return (
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
  );
}

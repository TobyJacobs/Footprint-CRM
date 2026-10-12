import type { Metadata } from "next";
import { Card, Notice, inputClass, primaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveCostRates } from "../actions";

export const metadata: Metadata = { title: "Staff cost rates" };

// What an hour of each person's time costs the business, used to show the cost
// of staff time on each project. Only admins can see and change these here;
// directors and finance see the resulting cost on a project.
export default async function CostRatesPage(props: PageProps<"/projects/rates">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: people }, { data: rates }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase.from("staff_cost_rates").select("user_id, hourly_cost, is_example"),
    supabase.from("company_settings").select("default_hourly_cost, default_hourly_cost_is_example").single(),
  ]);
  const rate = new Map((rates ?? []).map((r) => [r.user_id, r]));

  return (
    <div className="grid max-w-3xl gap-6">
      <Notice searchParams={sp} />
      <Card title="About cost rates">
        <p className="text-sm text-fp-dark/75">
          The hourly cost of each person (wages and overheads), in pounds. Anyone left blank uses the default rate.
          {settings?.default_hourly_cost_is_example && <strong> The default is a made-up example (£25). Please replace it with a real figure.</strong>}
        </p>
      </Card>
      <form action={saveCostRates} className="grid gap-4 rounded-lg border border-fp-border bg-white p-6">
        <label className="grid gap-1 text-sm sm:max-w-xs">
          <span className="font-semibold">Default hourly cost (£)</span>
          <input name="default_hourly_cost" type="number" step="0.01" min="0" defaultValue={settings?.default_hourly_cost ?? 25} className={inputClass} />
        </label>
        <div className="grid gap-2">
          {(people ?? []).map((p) => (
            <label key={p.id} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_140px]">
              <span>{p.full_name ?? p.email}</span>
              <input name={`rate_${p.id}`} type="number" step="0.01" min="0" defaultValue={rate.get(p.id)?.hourly_cost ?? ""} placeholder="Default" className={inputClass} />
            </label>
          ))}
        </div>
        <div>
          <button type="submit" className={primaryButton}>
            Save rates
          </button>
        </div>
      </form>
    </div>
  );
}

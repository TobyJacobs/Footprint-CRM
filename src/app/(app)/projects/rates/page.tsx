import type { Metadata } from "next";
import { Card, Notice, inputClass, primaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveCostRates } from "../actions";

export const metadata: Metadata = { title: "Staff cost rates" };

// What an hour of staff time costs the business, set per role. Used to work
// out the cost of staff time and the profit after time on each project. Only
// admins can see and change these here; directors and finance see the results.
export default async function CostRatesPage(props: PageProps<"/projects/rates">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: roles }, { data: rates }, { data: settings }] = await Promise.all([
    supabase.from("roles").select("id, name").order("name"),
    supabase.from("role_cost_rates").select("role_id, hourly_cost, is_example"),
    supabase.from("company_settings").select("default_hourly_cost, default_hourly_cost_is_example").single(),
  ]);
  const rate = new Map((rates ?? []).map((r) => [r.role_id, r]));
  const anyExample = (rates ?? []).some((r) => r.is_example) || settings?.default_hourly_cost_is_example;

  return (
    <div className="grid max-w-3xl gap-6">
      <Notice searchParams={sp} />
      <Card title="About cost rates">
        <p className="text-sm text-fp-dark/75">
          The hourly cost of each role (wages plus overheads), in pounds. Everyone in a role uses its rate; someone with several roles uses the
          highest. People with no role, or a role left blank, use the default.
        </p>
        {anyExample && (
          <p className="mt-2 text-sm font-semibold text-fp-orange">
            Some rates are made-up examples (marked below). Replace them with real figures so profit after time is accurate.
          </p>
        )}
      </Card>
      <form action={saveCostRates} className="grid gap-4 rounded-lg border border-fp-border bg-white p-6">
        <label className="grid gap-1 text-sm sm:max-w-xs">
          <span className="font-semibold">Default hourly cost (£){settings?.default_hourly_cost_is_example && <span className="font-normal text-fp-orange"> · example</span>}</span>
          <input name="default_hourly_cost" type="number" step="0.01" min="0" defaultValue={settings?.default_hourly_cost ?? 25} className={inputClass} />
        </label>
        <div className="grid gap-2">
          {(roles ?? []).map((r) => {
            const current = rate.get(r.id);
            return (
              <label key={r.id} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_140px]">
                <span>
                  {r.name}
                  {current?.is_example && <span className="text-xs text-fp-orange"> · example</span>}
                </span>
                <input name={`rate_${r.id}`} type="number" step="0.01" min="0" defaultValue={current?.hourly_cost ?? ""} placeholder="Default" className={inputClass} />
              </label>
            );
          })}
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

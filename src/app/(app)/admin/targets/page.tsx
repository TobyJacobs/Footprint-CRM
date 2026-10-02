import { Trash2 } from "lucide-react";
import { Badge, Card, Field, Notice, inputClass, primaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { describeRule, type CommissionRule } from "@/lib/dashboards/data";
import { createClient } from "@/lib/supabase/server";
import {
  deleteCommissionRule, deleteTarget, saveCommissionRule, saveGroupTargets, saveMonthTarget, savePersonTargets,
} from "../actions";

function RuleFields({ rule }: { rule?: Partial<CommissionRule> | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Rate (%)">
        <input name="rate" inputMode="decimal" required defaultValue={rule?.rate ?? ""} className={inputClass} placeholder="e.g. 10" />
      </Field>
      <Field label="Of">
        <select name="basis" defaultValue={rule?.basis ?? "gross_profit"} className={inputClass}>
          <option value="gross_profit">Gross profit</option>
          <option value="invoiced">Sales (ex VAT)</option>
        </select>
      </Field>
      <Field label="Counted when the invoice is">
        <select name="counted_when" defaultValue={rule?.counted_when ?? "paid"} className={inputClass}>
          <option value="paid">Paid</option>
          <option value="invoiced">Raised</option>
        </select>
      </Field>
    </div>
  );
}

export default async function TargetsPage(props: PageProps<"/admin/targets">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const supabase = await createClient();

  const [{ data: targets }, { data: rules }, { data: people }, { data: userRoles }, { data: roles }] = await Promise.all([
    supabase.from("monthly_targets").select("id, user_id, metric, month, amount, is_example"),
    supabase.from("commission_rules").select("id, user_id, basis, rate, counted_when, is_example"),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase.from("user_roles").select("user_id, role_id"),
    supabase.from("roles").select("id, name, dashboard"),
  ]);

  const group = (metric: string) => (targets ?? []).find((t) => t.user_id === null && t.metric === metric && t.month === null);
  const monthOverrides = (targets ?? []).filter((t) => t.user_id === null && t.metric === "invoiced" && t.month).sort((a, b) => a.month!.localeCompare(b.month!));
  const personTarget = (id: string) => (targets ?? []).find((t) => t.user_id === id && t.metric === "invoiced" && t.month === null);
  const defaultRule = (rules ?? []).find((r) => r.user_id === null) as CommissionRule | undefined;
  const personRules = (rules ?? []).filter((r) => r.user_id) as CommissionRule[];
  const nameOf = (id: string) => {
    const p = (people ?? []).find((x) => x.id === id);
    return p ? (p.full_name ?? p.email) : "Former member of staff";
  };

  // People with a Sales or Directors home page get personal sales targets.
  const salesRoleIds = new Set((roles ?? []).filter((r) => r.dashboard === "sales" || r.dashboard === "director").map((r) => r.id));
  const salesPeople = (people ?? []).filter((p) => (userRoles ?? []).some((ur) => ur.user_id === p.id && salesRoleIds.has(ur.role_id)));
  const exampleBadge = <span className="ml-2"><Badge tone="amber">Example</Badge></span>;

  return (
    <div className="grid max-w-4xl gap-6">
      <Notice searchParams={sp} />

      <Card title="Group goals (every month)">
        <p className="mb-4 text-sm text-fp-dark/75">
          These show on the Directors&apos; and Finance home pages and in everyone&apos;s Staff hub. Sales means invoiced
          value, excluding VAT, after credit notes. Leave a box empty for no target.
        </p>
        <form action={saveGroupTargets} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Monthly sales goal (£)">
              <input name="invoiced" inputMode="decimal" defaultValue={group("invoiced")?.amount ?? ""} className={inputClass} />
            </Field>
            <Field label="Monthly gross profit goal (£)">
              <input name="gross_profit" inputMode="decimal" defaultValue={group("gross_profit")?.amount ?? ""} className={inputClass} />
            </Field>
            <Field label="Target margin (%)">
              <input name="margin_pct" inputMode="decimal" defaultValue={group("margin_pct")?.amount ?? ""} className={inputClass} />
            </Field>
          </div>
          {[group("invoiced"), group("margin_pct"), group("gross_profit")].some((t) => t?.is_example) && (
            <p className="text-xs text-fp-dark/70">Some of these are still example figures.{exampleBadge} Saving makes them real.</p>
          )}
          <div>
            <button type="submit" className={primaryButton}>Save group goals</button>
          </div>
        </form>

        <div className="mt-6 border-t border-fp-border pt-4">
          <p className="mb-2 text-sm font-semibold">A different sales goal for a particular month</p>
          {monthOverrides.length > 0 && (
            <ul className="mb-3 grid gap-1 text-sm">
              {monthOverrides.map((t) => (
                <li key={t.id} className="flex items-center gap-3">
                  <span>
                    {new Date(t.month!).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}: <strong>£{Number(t.amount).toLocaleString("en-GB")}</strong>
                  </span>
                  <form action={deleteTarget.bind(null, t.id)}>
                    <button type="submit" className="inline-flex items-center gap-1 text-xs font-semibold text-fp-error hover:underline">
                      <Trash2 size={12} aria-hidden /> Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={saveMonthTarget} className="grid items-end gap-3 sm:grid-cols-[180px_200px_auto]">
            <Field label="Month">
              <input name="month" type="month" required className={inputClass} />
            </Field>
            <Field label="Sales goal (£)">
              <input name="amount" inputMode="decimal" required className={inputClass} />
            </Field>
            <button type="submit" className={primaryButton}>Set month goal</button>
          </form>
        </div>
      </Card>

      <Card title="Personal sales targets (every month)">
        {salesPeople.length === 0 ? (
          <p className="text-sm text-fp-dark/75">
            Nobody has a Sales team or Directors role yet. Give people roles in Users (or let the Microsoft 365 sync do it) and
            they&apos;ll appear here.
          </p>
        ) : (
          <form action={savePersonTargets} className="grid gap-3">
            {salesPeople.map((p) => (
              <label key={p.id} className="grid items-center gap-3 text-sm sm:grid-cols-[1fr_200px]">
                <span className="font-semibold">{p.full_name ?? p.email}</span>
                <input name={`target_${p.id}`} inputMode="decimal" defaultValue={personTarget(p.id)?.amount ?? ""} className={inputClass} placeholder="No target" />
              </label>
            ))}
            <div>
              <button type="submit" className={primaryButton}>Save personal targets</button>
            </div>
          </form>
        )}
      </Card>

      <Card title="Commission">
        <p className="mb-4 text-sm text-fp-dark/75">
          The standard rule applies to everyone unless they have their own. Commission shows on each salesperson&apos;s home
          page and Staff hub, and on the Directors&apos; team table.
        </p>
        <p className="mb-2 text-sm font-semibold">
          Standard rule{defaultRule?.is_example && exampleBadge}
          {defaultRule && <span className="ml-2 font-normal text-fp-dark/70">({describeRule(defaultRule)})</span>}
        </p>
        <form action={saveCommissionRule.bind(null, null)} className="grid gap-3">
          <RuleFields rule={defaultRule} />
          <div>
            <button type="submit" className={primaryButton}>Save standard rule</button>
          </div>
        </form>

        <div className="mt-6 border-t border-fp-border pt-4">
          <p className="mb-2 text-sm font-semibold">Personal rules</p>
          {personRules.length > 0 && (
            <ul className="mb-4 grid gap-1 text-sm">
              {personRules.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3">
                  <span>
                    <strong>{nameOf(r.user_id!)}</strong>: {describeRule({ ...r, rate: Number(r.rate) })}
                  </span>
                  <form action={deleteCommissionRule.bind(null, r.id)}>
                    <button type="submit" className="inline-flex items-center gap-1 text-xs font-semibold text-fp-error hover:underline">
                      <Trash2 size={12} aria-hidden /> Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={saveCommissionRule.bind(null, null)} className="grid gap-3">
            <Field label="Person">
              <select name="user_id" required defaultValue="" className={inputClass}>
                <option value="" disabled>Choose someone…</option>
                {(people ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                ))}
              </select>
            </Field>
            <RuleFields />
            <div>
              <button type="submit" className={primaryButton}>Add or update personal rule</button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}

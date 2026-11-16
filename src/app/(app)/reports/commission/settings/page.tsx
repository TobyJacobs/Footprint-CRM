import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Card, Field, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { bandsText, commissionAreas } from "@/lib/commission";
import { createClient } from "@/lib/supabase/server";
import { addCommissionViewer, deleteCommissionTarget, removeCommissionViewer, saveCommissionTarget } from "./actions";

export const metadata: Metadata = { title: "Commission targets" };

type Target = {
  id: string;
  staff_id: string;
  label: string;
  measure: string;
  scope: string;
  business_units: string[];
  target: number;
  payout: string;
  position: number;
  active: boolean;
  commission_bands: { threshold: number; amount: number }[];
};

// Each salesperson's monthly targets and bands (Directors and commission
// viewers), and who can see commission (Directors choose).
export default async function CommissionSettings(props: PageProps<"/reports/commission/settings">) {
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_see_commission");
  if (allowed !== true) redirect("/reports/sales");
  const [{ data: targets }, { data: staff }, { data: viewers }, { data: profiles }, { data: director }] = await Promise.all([
    supabase.from("commission_targets").select("*, commission_bands(threshold, amount)").order("position").order("label"),
    supabase.from("staff_directory").select("id, display_name, account_enabled").order("display_name"),
    supabase.from("commission_viewers").select("profile_id, profiles!commission_viewers_profile_id_fkey(full_name, email)"),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase.rpc("is_director"),
  ]);
  const people = (staff ?? []).filter((s) => s.account_enabled !== false);
  const nameOf = new Map((staff ?? []).map((s) => [s.id as string, s.display_name as string]));
  const list = ((targets ?? []) as Target[]).sort((a, b) => (nameOf.get(a.staff_id) ?? "").localeCompare(nameOf.get(b.staff_id) ?? "") || a.position - b.position);

  const fields = (t?: Target) => (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Person">
          <select name="staff_id" required defaultValue={t?.staff_id ?? ""} className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name of the target">
          <input name="label" required maxLength={120} defaultValue={t?.label ?? ""} className={inputClass} placeholder="e.g. Individual target" />
        </Field>
        <Field label="Counts">
          <select name="measure" required defaultValue={t?.measure ?? "gp"} className={inputClass}>
            <option value="gp">Gross profit (sales minus cost)</option>
            <option value="revenue">Revenue (sales before VAT)</option>
          </select>
        </Field>
        <Field label="Whose sales">
          <select name="scope" defaultValue={t?.scope ?? "own"} className={inputClass}>
            <option value="own">Their own sales</option>
            <option value="group">The whole group&apos;s sales</option>
          </select>
        </Field>
        <Field label="Monthly target (£)">
          <input name="target" required inputMode="decimal" defaultValue={t ? Number(t.target) : ""} className={inputClass} />
        </Field>
        <Field label="Bands pay">
          <select name="payout" required defaultValue={t?.payout ?? "percent"} className={inputClass}>
            <option value="percent">A % of the figure</option>
            <option value="fixed">A fixed £ bonus</option>
          </select>
        </Field>
      </div>
      <fieldset className="grid gap-1 text-sm">
        <legend className="mb-1 font-semibold">Business areas (none ticked = all)</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {commissionAreas.map((a) => (
            <label key={a} className="flex items-center gap-2">
              <input type="checkbox" name="business_units" value={a} defaultChecked={t?.business_units.includes(a) ?? false} className="accent-fp-pink" />
              {a}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Bands, one per line: % of target reached = what they get" hint='e.g. "100 = 10" pays 10% of the figure (or a £10 bonus if bands pay a fixed bonus) at 100% of target.'>
        <textarea name="bands" rows={5} required defaultValue={t ? bandsText(t.commission_bands) : ""} className={`${inputClass} font-mono`} />
      </Field>
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={t?.active ?? true} className="accent-fp-pink" /> In use
        </label>
        <label className="flex items-center gap-2">
          Order <input name="position" type="number" defaultValue={t?.position ?? 0} className={`${inputClass} w-20`} />
        </label>
      </div>
    </div>
  );

  return (
    <div className="grid max-w-4xl gap-6">
      <Link href="/reports/commission" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Commission
      </Link>
      <Notice searchParams={sp} />
      {list.map((t) => (
        <details key={t.id} className="rounded-lg border border-fp-border bg-white">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4">
            <span className="font-bold">
              {nameOf.get(t.staff_id)} · {t.label}
              {!t.active && <span className="ml-2 text-xs font-normal text-fp-mid">(not in use)</span>}
            </span>
            <span className="text-sm text-fp-dark/75">£{Number(t.target).toLocaleString("en-GB")} a month</span>
          </summary>
          <div className="border-t border-fp-border p-4">
            <form action={saveCommissionTarget.bind(null, t.id)} className="grid gap-3">
              {fields(t)}
              <div>
                <button type="submit" className={primaryButton}>
                  Save target
                </button>
              </div>
            </form>
            <form action={deleteCommissionTarget.bind(null, t.id)} className="mt-3">
              <ConfirmSubmit className="text-xs font-semibold text-fp-error hover:underline" message={`Delete the target "${t.label}"?`}>
                Delete target
              </ConfirmSubmit>
            </form>
          </div>
        </details>
      ))}

      <Card title="Add a target">
        <form action={saveCommissionTarget.bind(null, null)} className="grid gap-3">
          {fields()}
          <div>
            <button type="submit" className={secondaryButton}>
              Add target
            </button>
          </div>
        </form>
      </Card>

      <Card title="Who can see commission">
        <p className="mb-3 text-sm text-fp-dark/75">Everyone with the Directors role, plus:</p>
        <ul className="mb-3 grid gap-1 text-sm">
          {(viewers ?? []).map((v) => {
            const p = v.profiles as unknown as { full_name: string | null; email: string } | null;
            return (
              <li key={v.profile_id} className="flex items-center justify-between gap-3">
                <span>{p?.full_name ?? p?.email ?? "Someone"}</span>
                {director === true && (
                  <form action={removeCommissionViewer.bind(null, v.profile_id)}>
                    <button type="submit" className="text-xs font-semibold text-fp-error hover:underline">
                      Remove
                    </button>
                  </form>
                )}
              </li>
            );
          })}
          {(viewers ?? []).length === 0 && <li className="text-fp-mid">Nobody else yet.</li>}
        </ul>
        {director === true && (
          <form action={addCommissionViewer} className="flex flex-wrap items-end gap-2">
            <Field label="Add someone">
              <select name="profile_id" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Choose…
                </option>
                {(profiles ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit" className={secondaryButton}>
              Add
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}

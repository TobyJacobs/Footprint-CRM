import { inputClass, primaryButton } from "@/components/ui";
import { accountAreas } from "@/lib/customers/account-managers";
import { saveAccountManagers } from "../actions";

type Person = { id: string; full_name: string | null; email: string };

// The customer's account managers (DJ, 9 November 2026): the main one (the
// customer's owner) and one per area. People who can edit customers change
// them here.
export default function AccountManagers({
  customerId,
  ownerId,
  byArea,
  staff,
  canEdit,
}: {
  customerId: string;
  ownerId: string | null;
  byArea: Record<string, string>;
  staff: Person[];
  canEdit: boolean;
}) {
  const name = (id: string | null | undefined) => {
    const p = staff.find((s) => s.id === id);
    return p ? (p.full_name ?? p.email) : null;
  };
  const people = [...staff].sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));
  const choose = (field: string, current: string | null | undefined, label: string) => (
    <label key={field} className="grid gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      <select name={field} defaultValue={current ?? ""} className={inputClass}>
        <option value="">Nobody</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name ?? p.email}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div id="glance" className="mb-5 scroll-mt-24">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">Account managers</h3>
      {/* Only the ones that are set (owner, 9 November 2026). */}
      {!name(ownerId) && !accountAreas.some((area) => name(byArea[area])) ? (
        <p className="text-sm text-fp-mid">No account managers yet.</p>
      ) : (
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {name(ownerId) && (
            <div>
              <dt className="text-xs text-fp-mid">Main</dt>
              <dd className="font-semibold">{name(ownerId)}</dd>
            </div>
          )}
          {accountAreas
            .filter((area) => name(byArea[area]))
            .map((area) => (
              <div key={area}>
                <dt className="text-xs text-fp-mid">{area}</dt>
                <dd className="font-semibold">{name(byArea[area])}</dd>
              </div>
            ))}
        </dl>
      )}
      {canEdit && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-fp-teal-deep">Change account managers</summary>
          <form action={saveAccountManagers.bind(null, customerId)} className="mt-3 grid gap-3 sm:grid-cols-3">
            {choose("owner_id", ownerId, "Main account manager")}
            {accountAreas.map((area) => choose(`am_${area}`, byArea[area], area))}
            <div className="sm:col-span-3">
              <button type="submit" className={primaryButton}>
                Save account managers
              </button>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}

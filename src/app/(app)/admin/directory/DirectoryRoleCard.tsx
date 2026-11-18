import { Badge, Card, inputClass, primaryButton } from "@/components/ui";
import { shortDateTime } from "@/lib/customers/display";
import { setDirectoryRole } from "../actions";

export type DirectoryEntry = {
  id: string;
  email: string;
  display_name: string | null;
  job_title: string | null;
  department: string | null;
  office_location: string | null;
  account_enabled: boolean;
  in_entra: boolean;
  role_id: string | null;
  last_synced_at: string | null;
};

// What Microsoft 365 says about someone, and the role they get from it.
export default function DirectoryRoleCard({
  entry,
  roles,
  ruleRoleId,
  back,
}: {
  entry: DirectoryEntry;
  roles: { id: string; name: string }[];
  ruleRoleId: string | null;
  back: string;
}) {
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const automatic = ruleRoleId ? `Automatic — ${roleName.get(ruleRoleId)} (from job title)` : "Automatic — no rule matches, so no role";

  return (
    <Card title="From Microsoft 365">
      <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
        {[
          ["Job title", entry.job_title],
          ["Department", entry.department],
          ["Office", entry.office_location],
          ["Email", entry.email],
          ["Last updated from Microsoft", shortDateTime(entry.last_synced_at)],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-fp-dark/75">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
      </dl>
      {(!entry.account_enabled || !entry.in_entra) && (
        <p className="mb-4">
          <Badge tone="red">{entry.in_entra ? "Switched off in Microsoft 365" : "No longer in Microsoft 365"}</Badge>
        </p>
      )}
      <form action={setDirectoryRole.bind(null, entry.id, back)} className="grid gap-2 text-sm sm:max-w-md">
        <label htmlFor="role_id" className="font-semibold">Role from Microsoft 365</label>
        <select id="role_id" name="role_id" defaultValue={entry.role_id ?? ""} className={inputClass}>
          <option value="">{automatic}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} (chosen for this person)
            </option>
          ))}
        </select>
        <p className="text-xs text-fp-dark/70">
          &ldquo;Automatic&rdquo; follows the job title rules and updates if their job title changes. Picking a role fixes it
          for this person.
        </p>
        <div>
          <button type="submit" className={primaryButton}>Save role</button>
        </div>
      </form>
    </Card>
  );
}

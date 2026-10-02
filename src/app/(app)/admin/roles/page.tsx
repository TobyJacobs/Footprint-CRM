import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { dashboardTypes } from "@/lib/dashboards/data";
import { createRole } from "../actions";
import DashboardSelect from "./DashboardSelect";
import { Card, Notice, inputClass, primaryButton } from "../ui";

export default async function RolesPage(props: PageProps<"/admin/roles">) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const [{ data: roles }, { data: userRoles }] = await Promise.all([
    supabase.from("roles").select("id, name, description, dashboard, own_records_only").order("name"),
    supabase.from("user_roles").select("role_id"),
  ]);
  const count = (id: string) => (userRoles ?? []).filter((r) => r.role_id === id).length;

  return (
    <>
      <Notice searchParams={searchParams} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Roles">
          <p className="mb-4 text-sm text-fp-dark/75">
            A role is a set of permissions, like &ldquo;Sales&rdquo; or &ldquo;Accounts&rdquo;. Give people roles
            on the Users tab. Someone with several roles gets everything those roles allow.
          </p>
          {(roles ?? []).length === 0 ? (
            <p className="text-sm text-fp-dark/75">No roles yet. Create your first one.</p>
          ) : (
            <ul className="divide-y divide-fp-border">
              {(roles ?? []).map((r) => (
                <li key={r.id} className="py-3">
                  <Link href={`/admin/roles/${r.id}`} className="font-semibold hover:text-fp-pink">
                    {r.name}
                  </Link>
                  <span className="ml-2 text-xs text-fp-mid">
                    {count(r.id)} {count(r.id) === 1 ? "person" : "people"} ·{" "}
                    {dashboardTypes.find((d) => d.value === r.dashboard)?.label ?? "General"} home page
                    {r.own_records_only && " · own documents only"}
                  </span>
                  {r.description && <p className="text-sm text-fp-dark/70">{r.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="New role">
          <form action={createRole} className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Name</span>
              <input name="name" required className={inputClass} placeholder="e.g. Sales" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Description (optional)</span>
              <input name="description" className={inputClass} />
            </label>
            <DashboardSelect />
            <div>
              <button type="submit" className={primaryButton}>Create role</button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Card, Notice } from "../ui";

export default async function UsersPage(props: PageProps<"/admin/users">) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const [{ data: users }, { data: userRoles }, { data: roles }, { data: members }, { data: teams }] =
    await Promise.all([
      supabase.from("profiles").select("id, email, full_name, is_admin, is_active").order("full_name"),
      supabase.from("user_roles").select("user_id, role_id"),
      supabase.from("roles").select("id, name"),
      supabase.from("team_members").select("user_id, team_id"),
      supabase.from("teams").select("id, name"),
    ]);

  const roleName = new Map((roles ?? []).map((r) => [r.id, r.name]));
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const rolesFor = (id: string) =>
    (userRoles ?? []).filter((r) => r.user_id === id).map((r) => roleName.get(r.role_id)).filter(Boolean);
  const teamsFor = (id: string) =>
    (members ?? []).filter((m) => m.user_id === id).map((m) => teamName.get(m.team_id)).filter(Boolean);

  return (
    <>
      <Notice searchParams={searchParams} />
      <Card>
        <p className="mb-4 text-sm text-fp-dark/75">
          People appear here the first time they sign in with their Microsoft account. Click someone to give
          them roles and teams.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
              <tr>
                <th className="py-2 pr-4 font-semibold">Name</th>
                <th className="py-2 pr-4 font-semibold">Roles</th>
                <th className="py-2 pr-4 font-semibold">Teams</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-b border-fp-border last:border-0">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/users/${u.id}`} className="font-semibold hover:text-fp-pink">
                      {u.full_name ?? u.email}
                    </Link>
                    <div className="text-xs text-fp-mid">{u.email}</div>
                  </td>
                  <td className="py-3 pr-4">{rolesFor(u.id).join(", ") || <span className="text-fp-mid">None</span>}</td>
                  <td className="py-3 pr-4">{teamsFor(u.id).join(", ") || <span className="text-fp-mid">None</span>}</td>
                  <td className="py-3">
                    {!u.is_active ? (
                      <span className="rounded-full bg-fp-light px-2 py-0.5 text-xs font-semibold text-fp-mid">Switched off</span>
                    ) : u.is_admin ? (
                      <span className="rounded-full bg-fp-pink/10 px-2 py-0.5 text-xs font-semibold text-fp-pink">Admin</span>
                    ) : (
                      <span className="rounded-full bg-fp-teal/15 px-2 py-0.5 text-xs font-semibold text-fp-teal-deep">Active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

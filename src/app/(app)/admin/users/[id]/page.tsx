import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { saveUser } from "../../actions";
import { Card, Notice, primaryButton } from "../../ui";

export default async function EditUserPage(props: PageProps<"/admin/users/[id]">) {
  const me = await requireAdmin();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const [{ data: user }, { data: roles }, { data: teams }, { data: userRoles }, { data: memberships }] =
    await Promise.all([
      supabase.from("profiles").select("id, email, full_name, is_admin, is_active").eq("id", id).maybeSingle(),
      supabase.from("roles").select("id, name, description").order("name"),
      supabase.from("teams").select("id, name").order("name"),
      supabase.from("user_roles").select("role_id").eq("user_id", id),
      supabase.from("team_members").select("team_id").eq("user_id", id),
    ]);
  if (!user) notFound();

  const hasRole = new Set((userRoles ?? []).map((r) => r.role_id));
  const inTeam = new Set((memberships ?? []).map((m) => m.team_id));
  const isMe = user.id === me.id;

  return (
    <>
      <Link href="/admin/users" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← All users
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">{user.full_name ?? user.email}</h2>
      <Notice searchParams={searchParams} />

      <form action={saveUser.bind(null, user.id)} className="grid max-w-3xl gap-6">
        <Card title="Access">
          {isMe ? (
            <p className="text-sm text-fp-dark/75">
              This is you. To stop anyone locking themselves out, you can&apos;t change your own admin or
              active status — ask another admin.
            </p>
          ) : (
            <div className="grid gap-3 text-sm">
              <label className="flex items-start gap-3">
                <input type="checkbox" name="is_active" defaultChecked={user.is_active} className="mt-0.5 accent-fp-pink" />
                <span>
                  <span className="font-semibold">Active</span>
                  <span className="block text-fp-dark/70">Untick to switch this person off. They won&apos;t be able to use the platform.</span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" name="is_admin" defaultChecked={user.is_admin} className="mt-0.5 accent-fp-pink" />
                <span>
                  <span className="font-semibold">Admin</span>
                  <span className="block text-fp-dark/70">Can see everything and manage users, teams and roles.</span>
                </span>
              </label>
            </div>
          )}
        </Card>

        <Card title="Roles">
          {(roles ?? []).length === 0 ? (
            <p className="text-sm text-fp-dark/75">
              No roles yet. <Link href="/admin/roles" className="font-semibold text-fp-teal-deep hover:underline">Create one</Link>.
            </p>
          ) : (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {(roles ?? []).map((r) => (
                <label key={r.id} className="flex items-start gap-3">
                  <input type="checkbox" name="roles" value={r.id} defaultChecked={hasRole.has(r.id)} className="mt-0.5 accent-fp-pink" />
                  <span>
                    <span className="font-semibold">{r.name}</span>
                    {r.description && <span className="block text-fp-dark/70">{r.description}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </Card>

        <Card title="Teams">
          {(teams ?? []).length === 0 ? (
            <p className="text-sm text-fp-dark/75">
              No teams yet. <Link href="/admin/teams" className="font-semibold text-fp-teal-deep hover:underline">Create one</Link>.
            </p>
          ) : (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {(teams ?? []).map((t) => (
                <label key={t.id} className="flex items-center gap-3">
                  <input type="checkbox" name="teams" value={t.id} defaultChecked={inTeam.has(t.id)} className="accent-fp-pink" />
                  <span className="font-semibold">{t.name}</span>
                </label>
              ))}
            </div>
          )}
        </Card>

        <div>
          <button type="submit" className={primaryButton}>Save changes</button>
        </div>
      </form>
    </>
  );
}

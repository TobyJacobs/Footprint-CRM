import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { deleteTeam, saveTeam } from "../../actions";
import { Card, Notice, dangerButton, inputClass, primaryButton } from "../../ui";

export default async function EditTeamPage(props: PageProps<"/admin/teams/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const [{ data: team }, { data: users }, { data: members }] = await Promise.all([
    supabase.from("teams").select("id, name, description").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, email, full_name").eq("is_active", true).order("full_name"),
    supabase.from("team_members").select("user_id").eq("team_id", id),
  ]);
  if (!team) notFound();
  const isMember = new Set((members ?? []).map((m) => m.user_id));

  return (
    <>
      <Link href="/admin/teams" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← All teams
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">{team.name}</h2>
      <Notice searchParams={searchParams} />

      <form action={saveTeam.bind(null, team.id)} className="grid max-w-3xl gap-6">
        <Card title="Details">
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Name</span>
              <input name="name" required defaultValue={team.name} className={inputClass} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Description (optional)</span>
              <input name="description" defaultValue={team.description ?? ""} className={inputClass} />
            </label>
          </div>
        </Card>
        <Card title="Members">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {(users ?? []).map((u) => (
              <label key={u.id} className="flex items-center gap-3">
                <input type="checkbox" name="members" value={u.id} defaultChecked={isMember.has(u.id)} className="accent-fp-pink" />
                <span className="font-semibold">{u.full_name ?? u.email}</span>
              </label>
            ))}
          </div>
        </Card>
        <div>
          <button type="submit" className={primaryButton}>Save changes</button>
        </div>
      </form>

      <form action={deleteTeam.bind(null, team.id)} className="mt-10 max-w-3xl border-t border-fp-border pt-6">
        <p className="mb-3 text-sm text-fp-dark/75">
          Deleting a team removes it and its member list. People&apos;s accounts are not affected.
        </p>
        <button type="submit" className={dangerButton}>Delete team</button>
      </form>
    </>
  );
}

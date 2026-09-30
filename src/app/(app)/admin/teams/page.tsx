import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createTeam } from "../actions";
import { Card, Notice, inputClass, primaryButton } from "../ui";

export default async function TeamsPage(props: PageProps<"/admin/teams">) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase.from("teams").select("id, name, description").order("name"),
    supabase.from("team_members").select("team_id"),
  ]);
  const count = (id: string) => (members ?? []).filter((m) => m.team_id === id).length;

  return (
    <>
      <Notice searchParams={searchParams} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Teams">
          {(teams ?? []).length === 0 ? (
            <p className="text-sm text-fp-dark/75">No teams yet. Create your first one.</p>
          ) : (
            <ul className="divide-y divide-fp-border">
              {(teams ?? []).map((t) => (
                <li key={t.id} className="py-3">
                  <Link href={`/admin/teams/${t.id}`} className="font-semibold hover:text-fp-pink">
                    {t.name}
                  </Link>
                  <span className="ml-2 text-xs text-fp-mid">
                    {count(t.id)} {count(t.id) === 1 ? "person" : "people"}
                  </span>
                  {t.description && <p className="text-sm text-fp-dark/70">{t.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="New team">
          <form action={createTeam} className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Name</span>
              <input name="name" required className={inputClass} placeholder="e.g. Design" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Description (optional)</span>
              <input name="description" className={inputClass} />
            </label>
            <div>
              <button type="submit" className={primaryButton}>Create team</button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}

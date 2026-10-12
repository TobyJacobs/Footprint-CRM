import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { longDate } from "@/lib/customers/display";
import { isOpenProject, minutesText, projectGroups, projectStatusLabel, projectStatuses, projectTone, todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "open";
  const group = typeof sp.group === "string" ? sp.group : "";
  const mine = sp.mine === "1";
  const text = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select("id, number, name, project_group, status, due_date, owner_id, customers(id, name), owner:owner_id(full_name, email)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("number", { ascending: false })
    .limit(300);
  if (status === "open") query = query.in("status", ["active", "on_hold"]);
  else if (status !== "all") query = query.eq("status", status);
  if (group) query = query.eq("project_group", group);
  if (mine) query = query.eq("owner_id", user.id);
  if (text) query = query.or(`name.ilike.%${text.replace(/[%,()]/g, " ")}%,number.ilike.%${text.replace(/[%,()]/g, " ")}%`);

  const { data: projects } = await query;
  const ids = (projects ?? []).map((p) => p.id);
  const [{ data: tasks }, { data: costs }] = ids.length
    ? await Promise.all([
        supabase.from("project_tasks").select("project_id, status").in("project_id", ids),
        supabase.rpc("project_time_costs", { p_project_ids: ids }),
      ])
    : [{ data: [] }, { data: [] }];

  const taskCount = new Map<string, { done: number; total: number }>();
  for (const t of tasks ?? []) {
    const c = taskCount.get(t.project_id) ?? { done: 0, total: 0 };
    c.total += 1;
    if (t.status === "done") c.done += 1;
    taskCount.set(t.project_id, c);
  }
  const minutes = new Map<string, number>();
  for (const c of (costs ?? []) as { project_id: string; minutes: number }[]) minutes.set(c.project_id, Number(c.minutes));
  const today = todayIso();

  return (
    <>
      <Notice searchParams={sp} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Search</span>
            <input name="q" defaultValue={text} placeholder="Name or FO number" className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Show</span>
            <select name="status" defaultValue={status} className={inputClass}>
              <option value="open">Open projects</option>
              {projectStatuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} only
                </option>
              ))}
              <option value="all">Everything</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Group</span>
            <select name="group" defaultValue={group} className={inputClass}>
              <option value="">All groups</option>
              {projectGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="accent-fp-pink" />
            Only mine
          </label>
          <button type="submit" className={secondaryButton}>
            Apply
          </button>
        </form>
        {user.can("projects", "edit") && (
          <Link href="/projects/new" className={`${primaryButton} inline-flex items-center gap-2`}>
            <Plus size={16} aria-hidden /> New project
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-fp-border bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-fp-border bg-fp-offwhite text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="px-4 py-3 font-semibold">Project</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Group</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Due</th>
              <th className="px-4 py-3 text-right font-semibold">Tasks</th>
              <th className="px-4 py-3 text-right font-semibold">Time</th>
            </tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p) => {
              const customer = p.customers as unknown as { id: string; name: string } | null;
              const owner = p.owner as unknown as { full_name: string | null; email: string } | null;
              const t = taskCount.get(p.id);
              const overdue = p.due_date && p.due_date < today && isOpenProject(p.status);
              return (
                <tr key={p.id} className="border-b border-fp-border last:border-0 hover:bg-fp-offwhite">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-semibold hover:text-fp-pink">
                      {p.name}
                    </Link>
                    <span className="block text-xs text-fp-mid">{p.number}</span>
                  </td>
                  <td className="px-4 py-3">
                    {customer ? (
                      <Link href={`/customers/${customer.id}`} className="hover:text-fp-pink">
                        {customer.name}
                      </Link>
                    ) : (
                      <span className="text-fp-mid">Internal</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.project_group ?? <span className="text-fp-mid">—</span>}</td>
                  <td className="px-4 py-3">{owner ? (owner.full_name ?? owner.email) : <span className="text-fp-mid">—</span>}</td>
                  <td className="px-4 py-3">
                    <Badge tone={projectTone(p.status)}>{projectStatusLabel(p.status)}</Badge>
                  </td>
                  <td className={`px-4 py-3 ${overdue ? "font-semibold text-fp-error" : ""}`}>{longDate(p.due_date) ?? <span className="text-fp-mid">—</span>}</td>
                  <td className="px-4 py-3 text-right">{t ? `${t.done}/${t.total}` : <span className="text-fp-mid">—</span>}</td>
                  <td className="px-4 py-3 text-right">{minutes.has(p.id) ? minutesText(minutes.get(p.id)!) : <span className="text-fp-mid">—</span>}</td>
                </tr>
              );
            })}
            {(projects ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-fp-dark/70">
                  No projects here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

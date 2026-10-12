import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { longDate } from "@/lib/customers/display";
import { hoursText, projectStatusLabel, projectStatuses, projectTone, todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "open";
  const mine = sp.mine === "1";
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select("id, name, status, due_date, budget_hours, owner_id, customers(id, name), owner:owner_id(full_name, email)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("name")
    .limit(500);
  if (status === "open") query = query.in("status", ["planned", "active", "on_hold"]);
  else if (status !== "all") query = query.eq("status", status);
  if (mine) query = query.eq("owner_id", user.id);

  const [{ data: projects }, { data: tasks }, { data: hours }] = await Promise.all([
    query,
    supabase.from("project_tasks").select("project_id, status"),
    supabase.rpc("project_hours"),
  ]);

  const taskCount = new Map<string, { done: number; total: number }>();
  for (const t of tasks ?? []) {
    const c = taskCount.get(t.project_id) ?? { done: 0, total: 0 };
    c.total += 1;
    if (t.status === "done") c.done += 1;
    taskCount.set(t.project_id, c);
  }
  const logged = new Map((hours ?? []).map((h: { project_id: string; hours: number }) => [h.project_id, Number(h.hours)]));
  const today = todayIso();

  return (
    <>
      <Notice searchParams={sp} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <form className="flex flex-wrap items-end gap-3">
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
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-fp-border bg-fp-offwhite text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="px-4 py-3 font-semibold">Project</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Due</th>
              <th className="px-4 py-3 text-right font-semibold">Tasks</th>
              <th className="px-4 py-3 text-right font-semibold">Hours</th>
            </tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p) => {
              const customer = p.customers as unknown as { id: string; name: string } | null;
              const owner = p.owner as unknown as { full_name: string | null; email: string } | null;
              const t = taskCount.get(p.id);
              const h = logged.get(p.id) ?? 0;
              const overdue = p.due_date && p.due_date < today && ["planned", "active", "on_hold"].includes(p.status);
              return (
                <tr key={p.id} className="border-b border-fp-border last:border-0 hover:bg-fp-offwhite">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-semibold hover:text-fp-pink">
                      {p.name}
                    </Link>
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
                  <td className="px-4 py-3">{owner ? (owner.full_name ?? owner.email) : <span className="text-fp-mid">—</span>}</td>
                  <td className="px-4 py-3">
                    <Badge tone={projectTone(p.status)}>{projectStatusLabel(p.status)}</Badge>
                  </td>
                  <td className={`px-4 py-3 ${overdue ? "font-semibold text-fp-error" : ""}`}>{longDate(p.due_date) ?? <span className="text-fp-mid">—</span>}</td>
                  <td className="px-4 py-3 text-right">{t ? `${t.done}/${t.total}` : <span className="text-fp-mid">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    {hoursText(h)}
                    {p.budget_hours !== null && <span className="text-fp-mid"> / {hoursText(Number(p.budget_hours))}</span>}
                  </td>
                </tr>
              );
            })}
            {(projects ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-fp-dark/70">
                  No projects here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

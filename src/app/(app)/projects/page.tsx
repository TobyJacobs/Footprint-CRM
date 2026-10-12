import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { longDate } from "@/lib/customers/display";
import {
  PIPELINE_ALL_DONE,
  PIPELINE_NO_TASKS,
  isOpenProject,
  minutesText,
  projectGroups,
  projectStatusLabel,
  projectStatuses,
  projectTone,
  todayIso,
} from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";

type Summary = {
  done: number;
  total: number;
  estimated: number;
  stage: string;
  nextTitle: string | null;
  nextDue: string | null;
  firstPosition: number;
};

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const view = sp.view === "list" ? "list" : "pipeline";
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
        supabase.from("project_tasks").select("project_id, status, stage, position, title, due_date, estimated_minutes").in("project_id", ids).order("position").limit(10000),
        supabase.rpc("project_time_costs", { p_project_ids: ids }),
      ])
    : [{ data: [] }, { data: [] }];

  // One summary per project: progress, estimate and the stage of its first unfinished task.
  const summary = new Map<string, Summary>();
  for (const t of tasks ?? []) {
    const s =
      summary.get(t.project_id) ??
      ({ done: 0, total: 0, estimated: 0, stage: PIPELINE_ALL_DONE, nextTitle: null, nextDue: null, firstPosition: t.position } satisfies Summary);
    s.total += 1;
    s.estimated += t.estimated_minutes ?? 0;
    if (t.status === "done") s.done += 1;
    else if (s.nextTitle === null) {
      s.stage = t.stage;
      s.nextTitle = t.title;
      s.nextDue = t.due_date;
      s.firstPosition = t.position;
    }
    summary.set(t.project_id, s);
  }
  const minutes = new Map<string, number>();
  for (const c of (costs ?? []) as { project_id: string; minutes: number }[]) minutes.set(c.project_id, Number(c.minutes));
  const today = todayIso();

  // Keep the filters when switching between Pipeline and List.
  const keep = new URLSearchParams();
  if (text) keep.set("q", text);
  if (status !== "open") keep.set("status", status);
  if (group) keep.set("group", group);
  if (mine) keep.set("mine", "1");
  const viewLink = (v: string) => `/projects?${new URLSearchParams({ ...Object.fromEntries(keep), view: v }).toString()}`;
  const toggle = (v: string, label: string) => (
    <Link
      href={viewLink(v)}
      className={`px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-fp-dark text-white" : "bg-white hover:bg-fp-offwhite"}`}
      aria-current={view === v ? "page" : undefined}
    >
      {label}
    </Link>
  );

  // Pipeline columns: each project sits in the stage of its first unfinished task.
  // Most urgent first: overdue, then soonest due date, then projects with no date.
  const urgency = (p: { due_date: string | null }, s: Summary | undefined) => {
    const due = s?.nextDue ?? p.due_date;
    return due ?? "9999-12-31";
  };
  const columns = new Map<string, { name: string; order: number; items: NonNullable<typeof projects> }>();
  for (const p of projects ?? []) {
    const s = summary.get(p.id);
    const name = !s ? PIPELINE_NO_TASKS : s.stage;
    const order = !s ? -1 : name === PIPELINE_ALL_DONE ? 1e9 : s.firstPosition;
    const col = columns.get(name) ?? { name, order, items: [] };
    col.order = Math.min(col.order, order);
    col.items.push(p);
    columns.set(name, col);
  }
  const columnList = [...columns.values()].sort((a, b) => a.order - b.order);
  for (const c of columnList) c.items.sort((a, b) => urgency(a, summary.get(a.id)).localeCompare(urgency(b, summary.get(b.id))));

  return (
    <>
      <Notice searchParams={sp} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="view" value={view} />
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-md border border-fp-border">
            {toggle("pipeline", "Pipeline")}
            {toggle("list", "List")}
          </div>
          {user.can("projects", "edit") && (
            <Link href="/projects/new" className={`${primaryButton} inline-flex items-center gap-2`}>
              <Plus size={16} aria-hidden /> New project
            </Link>
          )}
        </div>
      </div>

      {view === "pipeline" ? (
        columnList.length === 0 ? (
          <p className="rounded-lg border border-fp-border bg-white px-4 py-8 text-center text-fp-dark/70">No projects here.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columnList.map((col) => (
              <section key={col.name} className="w-72 shrink-0 rounded-lg border border-fp-border bg-fp-offwhite">
                <h3 className="flex items-center justify-between border-b border-fp-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-fp-mid">
                  <span>{col.name}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-fp-dark">{col.items.length}</span>
                </h3>
                <ul className="grid gap-2 p-2">
                  {col.items.map((p) => {
                    const customer = p.customers as unknown as { id: string; name: string } | null;
                    const s = summary.get(p.id);
                    const logged = minutes.get(p.id) ?? 0;
                    const due = s?.nextDue ?? p.due_date;
                    const overdue = due && due < today && isOpenProject(p.status);
                    const over = s && s.estimated > 0 && logged > s.estimated;
                    return (
                      <li key={p.id} className={`rounded-md border bg-white p-3 text-sm ${overdue ? "border-fp-error" : "border-fp-border"}`}>
                        <Link href={`/projects/${p.id}`} className="font-semibold hover:text-fp-pink">
                          {p.name}
                        </Link>
                        <p className="text-xs text-fp-mid">
                          {p.number} · {customer ? customer.name : "Internal"}
                        </p>
                        {s?.nextTitle && <p className="mt-2 text-xs">Next: {s.nextTitle}</p>}
                        <p className={`mt-1 text-xs ${overdue ? "font-semibold text-fp-error" : "text-fp-dark/70"}`}>
                          {due ? `${overdue ? "Overdue · " : "Due "}${longDate(due)}` : "No due date"}
                        </p>
                        {s && (
                          <div className="mt-2">
                            <div className="h-1.5 overflow-hidden rounded-full bg-fp-border" role="img" aria-label={`${s.done} of ${s.total} tasks done`}>
                              <div className="h-full bg-fp-teal" style={{ width: `${s.total ? Math.round((s.done / s.total) * 100) : 0}%` }} />
                            </div>
                            <p className="mt-1 flex justify-between text-xs text-fp-dark/70">
                              <span>
                                {s.done}/{s.total} tasks
                              </span>
                              <span className={over ? "font-semibold text-fp-error" : ""}>
                                {minutesText(logged)}
                                {s.estimated > 0 && ` of ${minutesText(s.estimated)}`}
                              </span>
                            </p>
                          </div>
                        )}
                        {p.status !== "active" && (
                          <div className="mt-2">
                            <Badge tone={projectTone(p.status)}>{projectStatusLabel(p.status)}</Badge>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : (
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
                const t = summary.get(p.id);
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
                    <td className="px-4 py-3 text-right">
                      {minutes.has(p.id) ? (
                        <>
                          {minutesText(minutes.get(p.id)!)}
                          {t && t.estimated > 0 && <span className="text-fp-dark/70"> / {minutesText(t.estimated)}</span>}
                        </>
                      ) : t && t.estimated > 0 ? (
                        <span className="text-fp-dark/70">0m / {minutesText(t.estimated)}</span>
                      ) : (
                        <span className="text-fp-mid">—</span>
                      )}
                    </td>
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
      )}
    </>
  );
}

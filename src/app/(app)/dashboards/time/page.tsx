import Link from "next/link";
import { HoursBars } from "@/components/charts/DashboardCharts";
import { Tile } from "@/components/dashboards/parts";
import { Card, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { addDays, isDateIso, minutesText, todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { requireTab } from "../guard";

type Sum = { minutes: number; billable: number };
const add = (map: Map<string, Sum & { name: string; href?: string }>, key: string, name: string, minutes: number, billable: boolean, href?: string) => {
  const s = map.get(key) ?? { name, href, minutes: 0, billable: 0 };
  s.minutes += minutes;
  if (billable) s.billable += minutes;
  map.set(key, s);
};
const hours = (m: number) => Math.round((m / 60) * 10) / 10;

export default async function TimeDashboard(props: PageProps<"/dashboards/time">) {
  await requireTab("time");
  const sp = await props.searchParams;
  const today = todayIso();
  const monthStart = `${today.slice(0, 7)}-01`;
  const from = isDateIso(sp.from) ? sp.from : monthStart;
  const to = isDateIso(sp.to) && sp.to >= from ? sp.to : today;
  const supabase = await createClient();

  const lastMonthEnd = addDays(monthStart, -1);
  const presets = [
    { label: "This month", from: monthStart, to: today },
    { label: "Last month", from: `${lastMonthEnd.slice(0, 7)}-01`, to: lastMonthEnd },
    { label: "Last 90 days", from: addDays(today, -89), to: today },
  ];

  const [{ data: logs }, { data: finished }] = await Promise.all([
    supabase
      .from("time_logs")
      .select("minutes, billable, user_id, project_id, projects(id, number, name, customer_id, customers(id, name)), user:user_id(full_name, email)")
      .not("minutes", "is", null)
      .gte("log_date", from)
      .lte("log_date", to)
      .limit(20000),
    supabase
      .from("projects")
      .select("id, number, name, completed_at, customers(name)")
      .eq("status", "completed")
      .gte("completed_at", `${from}T00:00:00`)
      .lte("completed_at", `${to}T23:59:59`)
      .order("completed_at", { ascending: false })
      .limit(200),
  ]);

  const people = new Map<string, Sum & { name: string; href?: string }>();
  const customers = new Map<string, Sum & { name: string; href?: string }>();
  const projects = new Map<string, Sum & { name: string; href?: string }>();
  let total = 0;
  let billable = 0;
  for (const l of logs ?? []) {
    const m = Number(l.minutes ?? 0);
    const user = l.user as unknown as { full_name: string | null; email: string } | null;
    const project = l.projects as unknown as { id: string; number: string; name: string; customers: { id: string; name: string } | null } | null;
    total += m;
    if (l.billable) billable += m;
    add(people, l.user_id as string, user?.full_name ?? user?.email ?? "Unknown", m, !!l.billable);
    if (project) {
      add(projects, project.id, `${project.number} · ${project.name}`, m, !!l.billable, `/projects/${project.id}`);
      const c = project.customers;
      add(customers, c?.id ?? "internal", c?.name ?? "Internal (no customer)", m, !!l.billable, c ? `/customers/${c.id}` : undefined);
    }
  }
  const sorted = (map: typeof people) => [...map.values()].sort((a, b) => b.minutes - a.minutes);
  const billablePct = total > 0 ? Math.round((billable / total) * 100) : null;

  // Estimated against actual for jobs finished in the period (all their time, not just this period's).
  const finishedIds = (finished ?? []).map((p) => p.id);
  const [{ data: estimates }, { data: allTime }] = finishedIds.length
    ? await Promise.all([
        supabase.from("project_tasks").select("project_id, estimated_minutes").in("project_id", finishedIds).limit(20000),
        supabase.from("time_logs").select("project_id, minutes").in("project_id", finishedIds).not("minutes", "is", null).limit(50000),
      ])
    : [{ data: [] }, { data: [] }];
  const estBy = new Map<string, number>();
  for (const t of estimates ?? []) estBy.set(t.project_id as string, (estBy.get(t.project_id as string) ?? 0) + Number(t.estimated_minutes ?? 0));
  const actBy = new Map<string, number>();
  for (const t of allTime ?? []) actBy.set(t.project_id as string, (actBy.get(t.project_id as string) ?? 0) + Number(t.minutes ?? 0));
  const jobs = (finished ?? []).map((p) => {
    const est = estBy.get(p.id) ?? 0;
    const act = actBy.get(p.id) ?? 0;
    return { p, est, act, diff: est > 0 ? Math.round(((act - est) / est) * 100) : null };
  });
  const withEstimate = jobs.filter((j) => j.est > 0);
  const overRun = withEstimate.filter((j) => j.act > j.est).length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <label className="grid gap-1">
            <span className="font-semibold">From</span>
            <input type="date" name="from" defaultValue={from} className={inputClass} />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">To</span>
            <input type="date" name="to" defaultValue={to} className={inputClass} />
          </label>
          <button type="submit" className={secondaryButton}>
            Show
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Link key={p.label} href={`/dashboards/time?from=${p.from}&to=${p.to}`} className={p.from === from && p.to === to ? primaryButton : secondaryButton}>
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Hours logged" value={minutesText(total)} note={`${people.size} ${people.size === 1 ? "person" : "people"} · ${projects.size} projects`} />
        <Tile label="Billable" value={billablePct === null ? "—" : `${billablePct}%`} note={`${minutesText(billable)} billable`} tone="teal" />
        <Tile label="Jobs finished" value={String(jobs.length)} note={`${withEstimate.length} with estimates`} />
        <Tile
          label="Finished over estimate"
          value={withEstimate.length ? `${overRun} of ${withEstimate.length}` : "—"}
          note="Took longer than estimated"
          tone={overRun ? "amber" : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Hours by person">
          {people.size === 0 ? (
            <Empty />
          ) : (
            <HoursBars rows={sorted(people).map((s) => ({ name: s.name, billable: hours(s.billable), other: hours(s.minutes - s.billable) }))} />
          )}
        </Card>
        <Card title="Hours by customer">
          {customers.size === 0 ? (
            <Empty />
          ) : (
            <HoursBars rows={sorted(customers).slice(0, 12).map((s) => ({ name: s.name, billable: hours(s.billable), other: hours(s.minutes - s.billable) }))} />
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Busiest projects"
          action={
            <Link href={`/projects/reports?from=${from}&to=${to}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
              Full time report
            </Link>
          }
        >
          {projects.size === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-y divide-fp-border text-sm">
              {sorted(projects)
                .slice(0, 12)
                .map((s) => (
                  <li key={s.href} className="flex justify-between gap-3 py-1.5">
                    <Link href={s.href ?? "#"} className="min-w-0 truncate hover:text-fp-pink">
                      {s.name}
                    </Link>
                    <span className="shrink-0 font-semibold">{minutesText(s.minutes)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card title="Finished jobs: estimated against actual">
          {jobs.length === 0 ? (
            <p className="text-sm text-fp-mid">No projects were marked completed in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-fp-mid">
                  <tr>
                    <th className="py-1.5">Project</th>
                    <th className="py-1.5 text-right">Estimated</th>
                    <th className="py-1.5 text-right">Actual</th>
                    <th className="py-1.5 text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.slice(0, 15).map(({ p, est, act, diff }) => (
                    <tr key={p.id} className="border-t border-fp-border">
                      <td className="py-2">
                        <Link href={`/projects/${p.id}`} className="font-semibold hover:text-fp-pink">
                          {p.number}
                        </Link>
                        <span className="text-xs text-fp-mid"> · {(p.customers as unknown as { name: string } | null)?.name ?? p.name}</span>
                      </td>
                      <td className="py-2 text-right">{est ? minutesText(est) : "—"}</td>
                      <td className="py-2 text-right">{minutesText(act)}</td>
                      <td className={`py-2 text-right font-semibold ${diff !== null && diff > 0 ? "text-fp-error" : "text-fp-teal-deep"}`}>
                        {diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-fp-mid">No time logged in this period.</p>;
}

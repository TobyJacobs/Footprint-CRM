import type { Metadata } from "next";
import Link from "next/link";
import { Card, Notice } from "@/components/ui";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { requirePermission } from "@/lib/auth";
import { addDays, dayLabel, hoursText, isDateIso, todayIso, weekStart } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { deleteTimeEntry, logTime } from "../actions";
import TimeForm from "../TimeForm";

export const metadata: Metadata = { title: "My time" };

export default async function MyTimePage(props: PageProps<"/projects/time">) {
  const user = await requirePermission("projects", "view");
  const canLog = user.can("projects", "edit");
  const sp = await props.searchParams;
  const today = todayIso();
  const start = weekStart(isDateIso(sp.week) ? sp.week : today);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const supabase = await createClient();
  const [{ data: entries }, { data: projects }, { data: tasks }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id, project_id, task_id, work_date, hours, notes, projects(name), project_tasks(title)")
      .eq("user_id", user.id)
      .gte("work_date", start)
      .lte("work_date", end)
      .order("created_at"),
    supabase.from("projects").select("id, name").in("status", ["planned", "active", "on_hold"]).order("name"),
    supabase.from("project_tasks").select("id, project_id, title").neq("status", "done").order("position"),
  ]);

  const total = (entries ?? []).reduce((sum, e) => sum + Number(e.hours), 0);
  const back = `/projects/time?week=${start}`;
  const here = today >= start && today <= end;

  return (
    <>
      <Notice searchParams={sp} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link href={`/projects/time?week=${addDays(start, -7)}`} className="rounded-md border border-fp-border bg-white px-3 py-1.5 hover:bg-fp-light">
            ← Previous week
          </Link>
          <Link href="/projects/time" className="rounded-md border border-fp-border bg-white px-3 py-1.5 hover:bg-fp-light">
            This week
          </Link>
          <Link href={`/projects/time?week=${addDays(start, 7)}`} className="rounded-md border border-fp-border bg-white px-3 py-1.5 hover:bg-fp-light">
            Next week →
          </Link>
        </div>
        <p className="text-sm">
          {dayLabel(start)} to {dayLabel(end)} · <strong>{hoursText(total)}</strong> logged
        </p>
      </div>

      {canLog && (
        <div className="mb-6">
          <Card title="Log time">
            <TimeForm action={logTime} projects={projects ?? []} tasks={tasks ?? []} defaultDate={here ? today : start} back={back} />
          </Card>
        </div>
      )}

      <div className="grid gap-3">
        {days.map((d) => {
          const rows = (entries ?? []).filter((e) => e.work_date === d);
          const dayTotal = rows.reduce((sum, e) => sum + Number(e.hours), 0);
          return (
            <section key={d} className={`rounded-lg border bg-white p-4 ${d === today ? "border-fp-pink" : "border-fp-border"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{dayLabel(d)}</h3>
                <span className="text-sm font-semibold">{dayTotal > 0 ? hoursText(dayTotal) : <span className="text-fp-mid">—</span>}</span>
              </div>
              {rows.length > 0 && (
                <ul className="mt-2 divide-y divide-fp-border text-sm">
                  {rows.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        <strong>{hoursText(Number(e.hours))}</strong> ·{" "}
                        <Link href={`/projects/${e.project_id}`} className="hover:text-fp-pink">
                          {(e.projects as unknown as { name: string } | null)?.name ?? "Project"}
                        </Link>
                        {(e.project_tasks as unknown as { title: string } | null)?.title && (
                          <span className="text-fp-dark/70"> · {(e.project_tasks as unknown as { title: string }).title}</span>
                        )}
                        {e.notes && <span className="block text-xs text-fp-dark/70">{e.notes}</span>}
                      </span>
                      {canLog && (
                        <form action={deleteTimeEntry.bind(null, e.id)}>
                          <input type="hidden" name="back" value={back} />
                          <ConfirmSubmit className="text-xs font-semibold text-fp-error hover:underline" message="Delete this time entry?">
                            Delete
                          </ConfirmSubmit>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Square } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Card, Notice, inputClass, primaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { shortDateTime } from "@/lib/customers/display";
import { addDays, dayLabel, isDateIso, isOpenProject, minutesText, todayIso, weekStart } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { deleteTimeLog, logTime, stopTimer } from "../actions";
import TimeForm from "../TimeForm";

export const metadata: Metadata = { title: "My time" };

export default async function MyTimePage(props: PageProps<"/projects/time">) {
  const user = await requirePermission("projects", "view");
  const sp = await props.searchParams;
  const today = todayIso();
  const start = weekStart(isDateIso(sp.week) ? sp.week : today);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const supabase = await createClient();
  const [{ data: logs }, { data: projects }, { data: tasks }, { data: timer }] = await Promise.all([
    supabase
      .from("time_logs")
      .select("id, project_id, task_id, log_date, minutes, billable, notes, projects(number, name), project_tasks(title)")
      .eq("user_id", user.id)
      .not("minutes", "is", null)
      .gte("log_date", start)
      .lte("log_date", end)
      .order("created_at"),
    supabase.from("projects").select("id, number, name, status").in("status", ["active", "on_hold"]).order("number", { ascending: false }).limit(300),
    supabase.from("project_tasks").select("id, project_id, title").neq("status", "done").order("position").limit(3000),
    supabase.from("time_logs").select("id, started_at, projects(id, number, name)").eq("user_id", user.id).is("minutes", null).maybeSingle(),
  ]);

  const total = (logs ?? []).reduce((sum, l) => sum + Number(l.minutes), 0);
  const back = `/projects/time?week=${start}`;
  const here = today >= start && today <= end;
  const running = timer as unknown as { id: string; started_at: string; projects: { id: string; number: string; name: string } | null } | null;

  return (
    <>
      <Notice searchParams={sp} />

      {running && (
        <form action={stopTimer.bind(null, running.id)} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-fp-teal-deep/30 bg-fp-teal/10 p-4">
          <input type="hidden" name="back" value={back} />
          <p className="text-sm">
            <strong>Timer running</strong> on{" "}
            <Link href={`/projects/${running.projects?.id}`} className="font-semibold underline">
              {running.projects?.number} {running.projects?.name}
            </Link>{" "}
            since {shortDateTime(running.started_at)}.
          </p>
          <input name="notes" placeholder="What did you do? (optional)" className={`${inputClass} max-w-xs`} />
          <button type="submit" className={`${primaryButton} inline-flex items-center gap-2`}>
            <Square size={14} aria-hidden /> Stop timer
          </button>
        </form>
      )}

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
          {dayLabel(start)} to {dayLabel(end)} · <strong>{minutesText(total)}</strong> logged
        </p>
      </div>

      <div className="mb-6">
        <Card title="Log time">
          <TimeForm
            action={logTime}
            projects={(projects ?? []).filter((p) => isOpenProject(p.status)).map((p) => ({ id: p.id, name: `${p.number} ${p.name}` }))}
            tasks={tasks ?? []}
            defaultDate={here ? today : start}
            back={back}
          />
          <p className="mt-3 text-xs text-fp-dark/70">To use a timer instead, open a project and press &ldquo;Start timer&rdquo;.</p>
        </Card>
      </div>

      <div className="grid gap-3">
        {days.map((d) => {
          const rows = (logs ?? []).filter((l) => l.log_date === d);
          const dayTotal = rows.reduce((sum, l) => sum + Number(l.minutes), 0);
          return (
            <section key={d} className={`rounded-lg border bg-white p-4 ${d === today ? "border-fp-pink" : "border-fp-border"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{dayLabel(d)}</h3>
                <span className="text-sm font-semibold">{dayTotal > 0 ? minutesText(dayTotal) : <span className="text-fp-mid">—</span>}</span>
              </div>
              {rows.length > 0 && (
                <ul className="mt-2 divide-y divide-fp-border text-sm">
                  {rows.map((l) => {
                    const p = l.projects as unknown as { number: string; name: string } | null;
                    const t = l.project_tasks as unknown as { title: string } | null;
                    return (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>
                          <strong>{minutesText(Number(l.minutes))}</strong> ·{" "}
                          <Link href={`/projects/${l.project_id}`} className="hover:text-fp-pink">
                            {p ? `${p.number} ${p.name}` : "Project"}
                          </Link>
                          {t?.title && <span className="text-fp-dark/70"> · {t.title}</span>}
                          {!l.billable && <span className="ml-1 text-fp-mid">(not billable)</span>}
                          {l.notes && <span className="block text-xs text-fp-dark/70">{l.notes}</span>}
                        </span>
                        <form action={deleteTimeLog.bind(null, l.id)}>
                          <input type="hidden" name="back" value={back} />
                          <ConfirmSubmit className="text-xs font-semibold text-fp-error hover:underline" message="Delete this time entry?">
                            Delete
                          </ConfirmSubmit>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

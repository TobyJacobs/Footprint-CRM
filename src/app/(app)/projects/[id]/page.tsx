import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Play, Square, Trash2 } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Badge, Card, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { gbp, longDate, shortDateTime } from "@/lib/customers/display";
import { isOpenProject, minutesText, projectStatusLabel, projectTone, taskStatuses, todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { addTask, deleteProject, deleteTask, deleteTimeLog, logTime, startTimer, stopTimer, updateTask } from "../actions";
import TimeForm from "../TimeForm";

export async function generateMetadata(props: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("number, name").eq("id", id).maybeSingle();
  return { title: data ? `${data.number} ${data.name}` : "Project" };
}

type Person = { full_name: string | null; email: string } | null;
const nameOf = (p: Person) => (p ? (p.full_name ?? p.email) : null);

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const user = await getCurrentUser();
  const canEdit = user.can("projects", "edit");
  const canDelete = user.can("projects", "delete");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, customers(id, name), owner:owner_id(full_name, email), order:sales_document_id(id, number)")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: tasks }, { data: people }, { data: logs }, { data: costRows }, { data: myTimer }] = await Promise.all([
    supabase.from("project_tasks").select("*, assignee:assignee_id(full_name, email)").eq("project_id", id).order("position"),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase
      .from("time_logs")
      .select("id, task_id, user_id, log_date, minutes, started_at, billable, notes, user:user_id(full_name, email)")
      .eq("project_id", id)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.rpc("project_time_costs", { p_project_ids: [id] }),
    supabase.from("time_logs").select("id, project_id, started_at, projects(number, name)").eq("user_id", user.id).is("minutes", null).maybeSingle(),
  ]);

  const customer = project.customers as unknown as { id: string; name: string } | null;
  const owner = project.owner as unknown as Person;
  const order = project.order as unknown as { id: string; number: string } | null;
  const totals = ((costRows ?? []) as { minutes: number; billable_minutes: number | null; cost: number | null }[])[0];
  const today = todayIso();
  const open = isOpenProject(project.status);
  const done = (tasks ?? []).filter((t) => t.status === "done").length;
  const taskTitle = new Map((tasks ?? []).map((t) => [t.id, t.title]));

  // Tasks grouped into their stages, in order.
  const stages: { name: string; tasks: NonNullable<typeof tasks> }[] = [];
  for (const t of tasks ?? []) {
    let s = stages.find((x) => x.name === t.stage);
    if (!s) stages.push((s = { name: t.stage, tasks: [] }));
    s.tasks.push(t);
  }

  const timerHere = myTimer && myTimer.project_id === id ? myTimer : null;
  const timerElsewhere = myTimer && myTimer.project_id !== id ? (myTimer as unknown as { projects: { number: string; name: string } | null; project_id: string }) : null;
  const back = `/projects/${id}`;

  return (
    <>
      <Link href="/projects" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Projects
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-4">
        <h2 className="flex flex-wrap items-center gap-3 text-2xl font-black">
          <span className="text-fp-mid">{project.number}</span> {project.name}
          <Badge tone={projectTone(project.status)}>{projectStatusLabel(project.status)}</Badge>
        </h2>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Link href={`/projects/${id}/edit`} className={`${secondaryButton} inline-flex items-center gap-2`}>
              <Pencil size={14} aria-hidden /> Edit
            </Link>
          )}
          {canDelete && (
            <form action={deleteProject.bind(null, id)}>
              <ConfirmSubmit className={`${secondaryButton} inline-flex items-center gap-2 text-fp-error`} message={`Delete the project "${project.name}" with its tasks and time?`}>
                <Trash2 size={14} aria-hidden /> Delete
              </ConfirmSubmit>
            </form>
          )}
        </div>
      </div>
      <Notice searchParams={sp} />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          <section id="tasks">
            <Card title={`Tasks (${done}/${(tasks ?? []).length} done)`}>
              {stages.length === 0 && <p className="text-sm text-fp-dark/70">No tasks yet. Add the first one below.</p>}
              {stages.map((stage) => (
                <div key={stage.name} className="mb-5 last:mb-0">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-fp-mid">
                    {stage.name} · {stage.tasks.filter((t) => t.status === "done").length}/{stage.tasks.length}
                  </h3>
                  <ul className="divide-y divide-fp-border">
                    {stage.tasks.map((t) => {
                      const overdue = t.due_date && t.due_date < today && t.status !== "done";
                      return (
                        <li key={t.id} className="grid gap-2 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
                          <div>
                            <p className={`text-sm font-semibold ${t.status === "done" ? "text-fp-mid line-through" : ""}`}>{t.title}</p>
                            <p className="text-xs text-fp-dark/70">
                              {nameOf(t.assignee as unknown as Person) ?? "Unassigned"}
                              {t.due_date && <span className={overdue ? "font-semibold text-fp-error" : ""}> · due {longDate(t.due_date)}</span>}
                            </p>
                          </div>
                          {canEdit && (
                            <div className="flex flex-wrap items-center gap-2">
                              <form action={updateTask.bind(null, id, t.id)} className="flex items-center gap-2">
                                <select name="status" defaultValue={t.status} className={`${inputClass} w-auto py-1`} aria-label="Task status">
                                  {taskStatuses.map((s) => (
                                    <option key={s.value} value={s.value}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                                <select name="assignee_id" defaultValue={t.assignee_id ?? ""} className={`${inputClass} w-auto py-1`} aria-label="Assigned to">
                                  <option value="">Unassigned</option>
                                  {(people ?? []).map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.full_name ?? p.email}
                                    </option>
                                  ))}
                                </select>
                                <button type="submit" className={`${secondaryButton} py-1`}>
                                  Save
                                </button>
                              </form>
                              <form action={deleteTask.bind(null, id, t.id)}>
                                <ConfirmSubmit className="text-xs font-semibold text-fp-error hover:underline" message={`Delete the task "${t.title}"?`}>
                                  Delete
                                </ConfirmSubmit>
                              </form>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {canEdit && (
                <form action={addTask.bind(null, id)} className="mt-4 grid gap-3 border-t border-fp-border pt-4 sm:grid-cols-[2fr_1.2fr_1.5fr_1fr_auto] sm:items-end">
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">New task</span>
                    <input name="title" required className={inputClass} placeholder="What needs doing?" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">Stage</span>
                    <input name="stage" list="stages" className={inputClass} placeholder="General" />
                    <datalist id="stages">
                      {stages.map((s) => (
                        <option key={s.name} value={s.name} />
                      ))}
                    </datalist>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">Assigned to</span>
                    <select name="assignee_id" className={inputClass} defaultValue="">
                      <option value="">Unassigned</option>
                      {(people ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name ?? p.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">Due</span>
                    <input name="due_date" type="date" className={inputClass} />
                  </label>
                  <button type="submit" className={primaryButton}>
                    Add
                  </button>
                </form>
              )}
            </Card>
          </section>

          <Card title="Time on this project">
            <div className="mb-5 grid gap-4 border-b border-fp-border pb-5">
              {timerHere ? (
                <form action={stopTimer.bind(null, timerHere.id)} className="flex flex-wrap items-end gap-3 rounded-md bg-fp-teal/10 p-3">
                  <input type="hidden" name="back" value={back} />
                  <p className="text-sm">
                    <strong>Timer running</strong> since {shortDateTime(timerHere.started_at)}.
                  </p>
                  <input name="notes" placeholder="What did you do? (optional)" className={`${inputClass} max-w-xs`} />
                  <button type="submit" className={`${primaryButton} inline-flex items-center gap-2`}>
                    <Square size={14} aria-hidden /> Stop timer
                  </button>
                </form>
              ) : timerElsewhere ? (
                <p className="rounded-md bg-fp-amber/15 px-3 py-2 text-sm">
                  You have a timer running on{" "}
                  <Link href={`/projects/${timerElsewhere.project_id}`} className="font-semibold underline">
                    {timerElsewhere.projects?.number}
                  </Link>
                  . Stop it before starting another.
                </p>
              ) : (
                <form action={startTimer.bind(null, id)} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="back" value={back} />
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">Task (optional)</span>
                    <select name="task_id" className={`${inputClass} min-w-48`} defaultValue="">
                      <option value="">Whole project</option>
                      {(tasks ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className={`${primaryButton} inline-flex items-center gap-2`}>
                    <Play size={14} aria-hidden /> Start timer
                  </button>
                </form>
              )}
              <TimeForm
                action={logTime}
                projects={[{ id, name: `${project.number} ${project.name}` }]}
                tasks={(tasks ?? []).map((t) => ({ id: t.id, project_id: id, title: t.title }))}
                defaultProjectId={id}
                defaultDate={today}
                back={back}
              />
            </div>
            {(logs ?? []).length === 0 ? (
              <p className="text-sm text-fp-dark/70">No time has been logged yet.</p>
            ) : (
              <ul className="divide-y divide-fp-border text-sm">
                {(logs ?? []).map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <strong>{l.minutes === null ? "Running…" : minutesText(l.minutes)}</strong> · {longDate(l.log_date)} · {nameOf(l.user as unknown as Person)}
                      {!l.billable && <span className="ml-1 text-fp-mid">(not billable)</span>}
                      {l.task_id && taskTitle.get(l.task_id) && <span className="text-fp-dark/70"> · {taskTitle.get(l.task_id)}</span>}
                      {l.notes && <span className="block text-xs text-fp-dark/70">{l.notes}</span>}
                    </span>
                    {l.minutes !== null && (l.user_id === user.id || canDelete) && (
                      <form action={deleteTimeLog.bind(null, l.id)}>
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
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card title="Details">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-fp-dark/70">Customer</dt>
                <dd>
                  {customer ? (
                    <Link href={`/customers/${customer.id}`} className="font-semibold hover:text-fp-pink">
                      {customer.name}
                    </Link>
                  ) : (
                    "Internal project"
                  )}
                </dd>
              </div>
              {order && (
                <div>
                  <dt className="text-fp-dark/70">Sales order</dt>
                  <dd>
                    <Link href={`/sales/${order.id}`} className="font-semibold hover:text-fp-pink">
                      {order.number}
                    </Link>
                  </dd>
                </div>
              )}
              {project.project_group && (
                <div>
                  <dt className="text-fp-dark/70">Group</dt>
                  <dd>{project.project_group}</dd>
                </div>
              )}
              <div>
                <dt className="text-fp-dark/70">Owner</dt>
                <dd>{nameOf(owner) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-fp-dark/70">Dates</dt>
                <dd className={project.due_date && project.due_date < today && open ? "font-semibold text-fp-error" : ""}>
                  {longDate(project.start_date)} → {longDate(project.due_date) ?? "no due date"}
                </dd>
              </div>
              <div>
                <dt className="text-fp-dark/70">Time logged</dt>
                <dd>
                  <strong>{minutesText(Number(totals?.minutes ?? 0))}</strong>
                  {totals?.billable_minutes != null && <span className="text-fp-dark/70"> ({minutesText(Number(totals.billable_minutes))} billable)</span>}
                </dd>
              </div>
              {totals?.cost != null && (
                <div>
                  <dt className="text-fp-dark/70">Staff time cost</dt>
                  <dd>{gbp(Number(totals.cost))}</dd>
                </div>
              )}
              {project.overview && (
                <div>
                  <dt className="text-fp-dark/70">Overview</dt>
                  <dd className="whitespace-pre-line">{project.overview}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

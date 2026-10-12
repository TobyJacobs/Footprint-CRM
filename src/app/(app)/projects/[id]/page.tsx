import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Badge, Card, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { longDate } from "@/lib/customers/display";
import { hoursText, projectStatusLabel, projectTone, taskStatusLabel, taskStatuses, todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { addTask, deleteProject, deleteTask, deleteTimeEntry, logTime, updateTask } from "../actions";
import TimeForm from "../TimeForm";

export async function generateMetadata(props: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Project" };
}

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const user = await getCurrentUser();
  const canEdit = user.can("projects", "edit");
  const canDelete = user.can("projects", "delete");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, customers(id, name), owner:owner_id(full_name, email), order:sales_document_id(id, number, doc_type)")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: tasks }, { data: people }, { data: entries }, { data: hoursRows }, { data: manager }] = await Promise.all([
    supabase.from("project_tasks").select("*, assignee:assignee_id(full_name, email)").eq("project_id", id).order("position").order("created_at"),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase
      .from("time_entries")
      .select("id, task_id, user_id, work_date, hours, notes, user:user_id(full_name, email)")
      .eq("project_id", id)
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.rpc("project_hours"),
    supabase.rpc("is_projects_manager"),
  ]);

  const isManager = manager === true;
  const customer = project.customers as unknown as { id: string; name: string } | null;
  const owner = project.owner as unknown as { full_name: string | null; email: string } | null;
  const order = project.order as unknown as { id: string; number: string } | null;
  const totalHours = Number((hoursRows ?? []).find((h: { project_id: string }) => h.project_id === id)?.hours ?? 0);
  const budget = project.budget_hours === null ? null : Number(project.budget_hours);
  const nameOf = (p: { full_name: string | null; email: string } | null) => (p ? (p.full_name ?? p.email) : null);
  const taskTitle = new Map((tasks ?? []).map((t) => [t.id, t.title]));
  const hoursByTask = new Map<string, number>();
  for (const e of entries ?? []) if (e.task_id) hoursByTask.set(e.task_id, (hoursByTask.get(e.task_id) ?? 0) + Number(e.hours));
  const today = todayIso();
  const open = ["planned", "active", "on_hold"].includes(project.status);
  const done = (tasks ?? []).filter((t) => t.status === "done").length;

  return (
    <>
      <Link href="/projects" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Projects
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-4">
        <h2 className="flex flex-wrap items-center gap-3 text-2xl font-black">
          {project.name} <Badge tone={projectTone(project.status)}>{projectStatusLabel(project.status)}</Badge>
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
              {(tasks ?? []).length === 0 ? (
                <p className="text-sm text-fp-dark/70">No tasks yet. Add the first one below.</p>
              ) : (
                <ul className="divide-y divide-fp-border">
                  {(tasks ?? []).map((t) => {
                    const assignee = t.assignee as unknown as { full_name: string | null; email: string } | null;
                    const overdue = t.due_date && t.due_date < today && t.status !== "done";
                    return (
                      <li key={t.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div>
                          <p className={`font-semibold ${t.status === "done" ? "text-fp-mid line-through" : ""}`}>{t.title}</p>
                          <p className="text-xs text-fp-dark/70">
                            {nameOf(assignee) ?? "Unassigned"}
                            {t.due_date && <span className={overdue ? "font-semibold text-fp-error" : ""}> · due {longDate(t.due_date)}</span>}
                            {t.estimate_hours !== null && ` · estimate ${hoursText(Number(t.estimate_hours))}`}
                            {hoursByTask.has(t.id) && ` · ${hoursText(hoursByTask.get(t.id)!)} logged`}
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
                        {!canEdit && <Badge tone={t.status === "done" ? "teal" : "grey"}>{taskStatusLabel(t.status)}</Badge>}
                      </li>
                    );
                  })}
                </ul>
              )}
              {canEdit && (
                <form action={addTask.bind(null, id)} className="mt-4 grid gap-3 border-t border-fp-border pt-4 sm:grid-cols-[2fr_1.5fr_1fr_1fr_auto] sm:items-end">
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">New task</span>
                    <input name="title" required className={inputClass} placeholder="What needs doing?" />
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
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">Est. hours</span>
                    <input name="estimate_hours" type="number" step="0.5" min="0" className={inputClass} />
                  </label>
                  <button type="submit" className={primaryButton}>
                    Add
                  </button>
                </form>
              )}
            </Card>
          </section>

          <Card title="Time on this project">
            {canEdit && (
              <div className="mb-5 border-b border-fp-border pb-5">
                <TimeForm
                  action={logTime}
                  projects={[{ id, name: project.name }]}
                  tasks={(tasks ?? []).map((t) => ({ id: t.id, project_id: id, title: t.title }))}
                  defaultProjectId={id}
                  defaultDate={today}
                  back={`/projects/${id}`}
                />
              </div>
            )}
            {(entries ?? []).length === 0 ? (
              <p className="text-sm text-fp-dark/70">{isManager ? "No time has been logged yet." : "You haven't logged any time on this project yet."}</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-fp-mid">{isManager ? "Everyone's recent entries" : "Your recent entries"}</p>
                <ul className="divide-y divide-fp-border text-sm">
                  {(entries ?? []).map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        <strong>{hoursText(Number(e.hours))}</strong> · {longDate(e.work_date)}
                        {isManager && <span> · {nameOf(e.user as unknown as { full_name: string | null; email: string } | null)}</span>}
                        {e.task_id && taskTitle.get(e.task_id) && <span className="text-fp-dark/70"> · {taskTitle.get(e.task_id)}</span>}
                        {e.notes && <span className="block text-xs text-fp-dark/70">{e.notes}</span>}
                      </span>
                      {canEdit && (e.user_id === user.id || isManager) && (
                        <form action={deleteTimeEntry.bind(null, e.id)}>
                          <input type="hidden" name="back" value={`/projects/${id}`} />
                          <ConfirmSubmit className="text-xs font-semibold text-fp-error hover:underline" message="Delete this time entry?">
                            Delete
                          </ConfirmSubmit>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </>
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
              <div>
                <dt className="text-fp-dark/70">Owner</dt>
                <dd>{nameOf(owner) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-fp-dark/70">Dates</dt>
                <dd className={project.due_date && project.due_date < today && open ? "font-semibold text-fp-error" : ""}>
                  {project.start_date ? `${longDate(project.start_date)} → ` : ""}
                  {longDate(project.due_date) ?? "No due date"}
                </dd>
              </div>
              <div>
                <dt className="text-fp-dark/70">Hours</dt>
                <dd>
                  <strong>{hoursText(totalHours)}</strong>
                  {budget !== null && (
                    <span className={totalHours > budget ? "font-semibold text-fp-error" : ""}> of {hoursText(budget)} budget</span>
                  )}
                </dd>
              </div>
              {project.description && (
                <div>
                  <dt className="text-fp-dark/70">Description</dt>
                  <dd className="whitespace-pre-line">{project.description}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

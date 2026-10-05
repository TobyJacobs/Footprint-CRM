import type { Metadata } from "next";
import Link from "next/link";
import { CheckSquare, ChevronRight, History, Square, Trash2 } from "lucide-react";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ExpandAll from "./ExpandAll";
import RoadmapTabs from "./RoadmapTabs";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { addRoadmapTask, deleteRoadmapTask, setWaveOnHold, submitRequest, toggleRoadmapTask } from "./actions";
import { RequestCard, pageOptions, waveLabel, type Comment, type RoadmapRequest, type Wave } from "./parts";

export const metadata: Metadata = { title: "Roadmap" };

type Task = { id: string; wave_id: string; title: string; done: boolean; done_at: string | null; position: number; request_id: string | null };

function waveStatus(w: Wave, tasks: Task[]) {
  const total = tasks.length;
  const finished = tasks.filter((t) => t.done).length;
  if (w.on_hold) return { label: "On hold", tone: "amber" as const, finished, total };
  if (total > 0 && finished === total) return { label: "Done", tone: "teal" as const, finished, total };
  if (finished > 0) return { label: "In progress", tone: "pink" as const, finished, total };
  return { label: "Not started", tone: "grey" as const, finished, total };
}

// The project roadmap, wave by wave, plus suggestions and bug reports.
export default async function RoadmapPage(props: PageProps<"/roadmap">) {
  const user = await getCurrentUser();
  if (!user.can("roadmap", "view")) return <NoAccess title="Roadmap" />;
  const sp = await props.searchParams;
  const supabase = await createClient();

  const [{ data: waves }, { data: tasks }, { data: requests }, { data: profiles }] = await Promise.all([
    supabase.from("roadmap_waves").select("*").order("position"),
    supabase.from("roadmap_tasks").select("id, wave_id, title, done, done_at, position, request_id").order("position"),
    supabase
      .from("feedback_requests")
      .select("*")
      .in("status", ["pending", "query"])
      .order("submitted_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const ids = (requests ?? []).map((r) => r.id);
  const { data: comments } = ids.length
    ? await supabase.from("feedback_comments").select("*").in("request_id", ids).order("created_at")
    : { data: [] };

  const allWaves = (waves ?? []) as Wave[];
  const allTasks = (tasks ?? []) as Task[];
  const open = (requests ?? []) as RoadmapRequest[];
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name ?? p.email) as string]));
  const commentsFor = (id: string) => ((comments ?? []) as Comment[]).filter((c) => c.request_id === id);
  const totalDone = allTasks.filter((t) => t.done).length;
  const mineOpen = open.filter((r) => r.submitted_by === user.id);

  return (
    <>
      <PageHeader
        title="Roadmap"
        intro="Where the platform is up to, wave by wave. Tasks are ticked off as they're finished. Spotted a bug or have an idea? Send it using the box on the right."
      />
      <RoadmapTabs current="roadmap" isAdmin={user.isAdmin} />
      <div className="px-6 py-8 lg:px-10">
        <Notice searchParams={sp} />
        {user.isAdmin && open.some((r) => r.status === "pending") && (
          <Link
            href="/roadmap/review"
            className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-fp-amber bg-fp-amber/10 px-4 py-3 text-sm font-semibold"
          >
            <span>
              {open.filter((r) => r.status === "pending").length} request
              {open.filter((r) => r.status === "pending").length === 1 ? "" : "s"} waiting for your decision
            </span>
            <span className="text-fp-teal-deep">Review →</span>
          </Link>
        )}
        {sp.sent && (
          <p role="status" className="mb-4 rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
            Thanks: your request has been sent to the admins. You&apos;ll see its progress under &ldquo;Your requests&rdquo;.
          </p>
        )}

        <div className="mb-6 rounded-lg border border-fp-border bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-bold">Overall progress</p>
            <p className="text-sm text-fp-dark/75">
              <span className="text-2xl font-black text-fp-black">{totalDone}</span> of {allTasks.length} tasks done
            </p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-fp-light">
            <div className="bg-fp-gradient h-full rounded-full" style={{ width: `${allTasks.length ? (totalDone / allTasks.length) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="grid content-start gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Waves</h2>
              <ExpandAll />
            </div>
            {allWaves.map((w) => {
              const waveTasks = allTasks.filter((t) => t.wave_id === w.id);
              const st = waveStatus(w, waveTasks);
              const fromRequests = waveTasks.filter((t) => t.request_id && !t.done).length;
              return (
                <details
                  key={w.id}
                  id={`wave-${w.code}`}
                  data-wave
                  open={sp.open === w.id}
                  className="group -mt-3 rounded-lg border border-fp-border bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4 hover:bg-fp-offwhite [&::-webkit-details-marker]:hidden">
                    <ChevronRight size={18} className="shrink-0 text-fp-mid transition-transform group-open:rotate-90" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="font-black">{waveLabel(w)}</h3>
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {fromRequests > 0 && (
                          <span className="text-xs font-semibold text-green-700">
                            {fromRequests} approved request{fromRequests === 1 ? "" : "s"} to do
                          </span>
                        )}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fp-light">
                        <div
                          className={`h-full rounded-full ${st.label === "Done" ? "bg-fp-teal-deep" : "bg-fp-pink"}`}
                          style={{ width: `${st.total ? (st.finished / st.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {st.finished}/{st.total}
                    </span>
                  </summary>

                  <div className="border-t border-fp-border px-4 pb-4 pt-3">
                    {w.description && <p className="mb-3 text-sm text-fp-dark/75">{w.description}</p>}
                    <ul className="grid gap-0.5 text-sm">
                      {waveTasks.map((t) => {
                        const Icon = t.done ? CheckSquare : Square;
                        const fromRequest = Boolean(t.request_id);
                        const label = (
                          <>
                            <Icon
                              size={18}
                              className={`mt-0.5 shrink-0 ${fromRequest ? "text-green-700" : t.done ? "text-fp-teal-deep" : "text-fp-mid"}`}
                              aria-hidden
                            />
                            <span
                              className={
                                fromRequest
                                  ? `font-semibold text-green-700 ${t.done ? "line-through opacity-70" : ""}`
                                  : t.done
                                    ? "text-fp-dark/60 line-through"
                                    : ""
                              }
                            >
                              {t.title}
                            </span>
                            {fromRequest && <span className="ml-1 shrink-0 text-xs font-semibold text-green-700">(approved request)</span>}
                          </>
                        );
                        return (
                          <li key={t.id} id={`task-${t.id}`}>
                            {user.isAdmin ? (
                              <div className="flex items-start gap-1">
                                <form action={toggleRoadmapTask.bind(null, t.id, w.id, !t.done)} className="min-w-0 flex-1">
                                  <button
                                    type="submit"
                                    className="flex w-full items-start gap-2 rounded px-1 py-1 text-left hover:bg-fp-offwhite"
                                    title={t.done ? "Mark as not done" : "Tick off"}
                                  >
                                    {label}
                                  </button>
                                </form>
                                <form action={deleteRoadmapTask.bind(null, t.id, w.id)}>
                                  <ConfirmSubmit
                                    className="rounded p-1.5 text-fp-mid hover:bg-fp-light hover:text-fp-error"
                                    message={`Delete the task "${t.title}"? This can't be undone.`}
                                  >
                                    <Trash2 size={15} aria-hidden />
                                    <span className="sr-only">Delete task</span>
                                  </ConfirmSubmit>
                                </form>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2 px-1 py-1">{label}</div>
                            )}
                          </li>
                        );
                      })}
                      {waveTasks.length === 0 && <li className="text-fp-dark/70">No tasks yet.</li>}
                    </ul>
                    {user.isAdmin && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-fp-border pt-3">
                        <form action={addRoadmapTask.bind(null, w.id)} className="flex flex-1 gap-2">
                          <input name="title" placeholder="Add a task to this wave…" className={`${inputClass} text-sm`} required />
                          <button type="submit" className={secondaryButton}>Add</button>
                        </form>
                        <form action={setWaveOnHold.bind(null, w.id, !w.on_hold)}>
                          <button type="submit" className="text-xs font-semibold text-fp-dark/70 underline hover:text-fp-black">
                            {w.on_hold ? "Take off hold" : "Put on hold"}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>

          <aside className="grid content-start gap-6 xl:sticky xl:top-6">
            <Card title="Send a suggestion or bug">
              <form action={submitRequest} className="grid gap-3 text-sm">
                <fieldset className="flex gap-4">
                  <legend className="mb-1 font-semibold">It&apos;s a…</legend>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="kind" value="suggestion" defaultChecked className="accent-fp-pink" /> Suggestion
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="kind" value="bug" className="accent-fp-pink" /> Bug
                  </label>
                </fieldset>
                <label className="grid gap-1">
                  <span className="font-semibold">Short title</span>
                  <input name="title" required maxLength={200} className={inputClass} placeholder="e.g. Show the customer's PO on invoices" />
                </label>
                <label className="grid gap-1">
                  <span className="font-semibold">Details</span>
                  <textarea name="details" rows={4} className={inputClass} placeholder="What happened, or what you'd like it to do" />
                </label>
                <label className="grid gap-1">
                  <span className="font-semibold">Which wave?</span>
                  <select name="wave_id" defaultValue="" className={inputClass}>
                    <option value="">Not sure</option>
                    {allWaves.map((w) => (
                      <option key={w.id} value={w.id}>{waveLabel(w)}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="font-semibold">Which page?</span>
                  <select name="page" defaultValue="" className={inputClass}>
                    <option value="">Not sure</option>
                    {pageOptions.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <div>
                  <button type="submit" className={primaryButton}>Send request</button>
                </div>
              </form>
            </Card>

            <Card title="Your requests">
              {mineOpen.length === 0 ? (
                <p className="text-sm text-fp-dark/75">Nothing waiting. Requests you send appear here until they&apos;re decided.</p>
              ) : (
                <div className="grid gap-3">
                  {mineOpen.map((r) => (
                    <RequestCard
                      key={r.id}
                      r={r}
                      waves={allWaves}
                      comments={commentsFor(r.id)}
                      names={names}
                      me={user.id}
                      isAdmin={user.isAdmin}
                      showActions={false}
                    />
                  ))}
                </div>
              )}
              <Link href="/roadmap/requests" className={`${secondaryButton} mt-4 inline-flex items-center gap-2`}>
                <History size={14} aria-hidden /> See old requests
              </Link>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}

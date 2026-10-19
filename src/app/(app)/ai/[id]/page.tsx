import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Badge, Card, Notice, dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { toRun, type AiProject } from "@/lib/ai/data";
import {
  aiStageLabel,
  aiStages,
  criteria,
  daysBetween,
  decisionLabel,
  decisionTone,
  hoursMinutes,
  liveFigures,
  progressIndex,
  progressSteps,
  scoreStatuses,
  scoreTone,
} from "@/lib/ai/options";
import { longDate, shortDateTime } from "@/lib/customers/display";
import { ukToday } from "@/lib/dates";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { addUpdate, deleteProject, deleteTestRun, deleteUpdate, logTestRun, saveProject, saveScorecard, setStage } from "../actions";
import { ProgressBar, ScoreDots, Stat } from "../parts";
import ProjectForm from "../ProjectForm";

export const metadata: Metadata = { title: "FootprintAI project" };

const money = (n: number | null) => (n === null ? "—" : `£${n.toFixed(2)}`);

export default async function AiProjectPage(props: PageProps<"/ai/[id]">) {
  const user = await requirePermission("ai", "view");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await props.searchParams;
  const supabase = await createClient();

  const [{ data: project }, { data: scoreRows }, { data: runRows }, { data: updates }, { pickable, nameOf }] = await Promise.all([
    supabase.from("ai_projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("ai_scores").select("criterion, status, evidence, updated_at, updated_by").eq("project_id", id),
    supabase
      .from("ai_test_runs")
      .select("id, run_date, task, stage, manual_minutes, agent_minutes, usable, errors, serious_error, cost, notes, logged_by")
      .eq("project_id", id)
      .order("run_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("ai_project_updates").select("id, body, author_id, created_at").eq("project_id", id).order("created_at", { ascending: false }),
    loadPeople(supabase),
  ]);
  if (!project) notFound();
  const p = project as AiProject;
  const scores = new Map((scoreRows ?? []).map((s) => [s.criterion as string, s]));
  const runs = runRows ?? [];
  const fig = liveFigures(runs.map(toRun));
  const today = ukToday();
  const daysToDecision = p.decision_date ? daysBetween(today, p.decision_date) : null;
  const step = progressIndex(p.stage);
  const nextStage = p.stage !== "on_hold" && step < progressSteps.length - 1 ? progressSteps[step + 1] : null;

  return (
    <div className="grid gap-6">
      <Link href="/ai" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← FootprintAI
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-fp-mid">
            {p.kind === "agent" ? "Agent" : p.kind === "system" ? "System" : "Project"}
            {p.wave ? ` · ${p.wave}` : ""} · {p.owner_id ? `Owner: ${nameOf.get(p.owner_id) ?? "—"}` : "No owner yet"}
          </p>
          <h2 className="text-2xl font-black">{p.title}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={p.stage === "live" ? "teal" : p.stage === "on_hold" ? "grey" : "amber"}>{aiStageLabel(p.stage)}</Badge>
            {p.decision && <Badge tone={decisionTone(p.decision)}>Decision: {decisionLabel(p.decision)}</Badge>}
            {daysToDecision !== null && !p.decision && (
              <span className="text-fp-mid">
                {daysToDecision >= 0 ? `Decision due in ${daysToDecision} day${daysToDecision === 1 ? "" : "s"}` : `Decision was due ${longDate(p.decision_date)}`}
              </span>
            )}
          </div>
        </div>
        {nextStage && (
          <form action={setStage.bind(null, p.id)}>
            <input type="hidden" name="stage" value={nextStage} />
            <button type="submit" className={primaryButton}>
              Move to {aiStageLabel(nextStage)} →
            </button>
          </form>
        )}
      </div>

      <Notice searchParams={sp} />

      <Card title="Progress">
        <ProgressBar stage={p.stage} />
        <p className="mt-3 text-sm text-fp-dark/75">{aiStages.find((s) => s.value === p.stage)?.help}</p>
        {p.next_step && (
          <p className="mt-2 text-sm">
            <span className="font-semibold">Next step:</span> {p.next_step}
          </p>
        )}
      </Card>

      <section id="figures">
        <Card title="Live figures (from the test log)">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Tests logged" value={String(fig.tests)} />
            <Stat label="Time saved" value={hoursMinutes(fig.minutesSaved)} hint={fig.savedPct !== null ? `${fig.savedPct}% less than by hand` : "Log times to see this"} />
            <Stat label="Usable with light edits" value={fig.usablePct !== null ? `${fig.usablePct}%` : "—"} />
            <Stat label="Errors" value={String(fig.errors)} hint={fig.seriousErrors ? `${fig.seriousErrors} serious` : "None serious"} />
            <Stat label="Spend" value={money(fig.cost)} hint={fig.costPerTest !== null ? `${money(fig.costPerTest)} per test` : undefined} />
          </div>
        </Card>
      </section>

      <section id="scorecard">
        <Card title="Scorecard">
          <div className="mb-4">
            <ScoreDots scores={[...scores.values()].map((s) => ({ criterion: s.criterion as string, status: s.status as string }))} />
            <p className="mt-2 text-xs text-fp-mid">It moves on, or joins the launch catalogue, only when every row passes. Pass marks are the brief&apos;s starting suggestions.</p>
          </div>
          <form action={saveScorecard.bind(null, p.id)} className="grid gap-3">
            {criteria.map((c) => {
              const s = scores.get(c.value);
              const status = (s?.status as string) ?? "not_started";
              return (
                <div key={c.value} className="grid gap-2 rounded-md border border-fp-border p-3 md:grid-cols-[1fr_160px]">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      {c.label} <Badge tone={scoreTone(status)}>{scoreStatuses.find((x) => x.value === status)?.label}</Badge>
                    </p>
                    <p className="text-xs text-fp-mid">
                      {c.how}. <span className="font-semibold">Pass:</span> {c.pass}.
                    </p>
                    <label className="sr-only" htmlFor={`evidence_${c.value}`}>
                      Evidence for {c.label}
                    </label>
                    <input
                      id={`evidence_${c.value}`}
                      name={`evidence_${c.value}`}
                      defaultValue={(s?.evidence as string | null) ?? ""}
                      placeholder="Evidence: what was checked, figures, who signed it off"
                      className={`${inputClass} mt-2`}
                    />
                    {s?.updated_by && (
                      <p className="mt-1 text-xs text-fp-mid">
                        Last changed by {nameOf.get(s.updated_by as string) ?? "someone"}, {shortDateTime(s.updated_at as string)}
                      </p>
                    )}
                  </div>
                  <label className="grid content-start gap-1 text-sm">
                    <span className="text-xs font-semibold text-fp-mid">Status</span>
                    <select name={`status_${c.value}`} defaultValue={status} className={inputClass}>
                      {scoreStatuses.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}
            <div>
              <button type="submit" className={primaryButton}>
                Save scorecard
              </button>
            </div>
          </form>
        </Card>
      </section>

      <section id="tests">
        <Card title={`Test log (${runs.length})`}>
          <form action={logTestRun.bind(null, p.id)} className="mb-5 grid gap-3 rounded-md bg-fp-offwhite p-4">
            <p className="text-sm font-semibold">Log a test</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Task</span>
                <input name="task" required maxLength={500} placeholder="e.g. Renewal email for Forest Vets" className={inputClass} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Date</span>
                <input name="run_date" type="date" defaultValue={today} className={inputClass} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Minutes by hand</span>
                <input name="manual_minutes" type="number" min={0} placeholder="Baseline" className={inputClass} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Minutes with agent</span>
                <input name="agent_minutes" type="number" min={0} placeholder="Incl. checking" className={inputClass} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Usable?</span>
                <select name="usable" defaultValue="" className={inputClass}>
                  <option value="">Not judged</option>
                  <option value="yes">Yes, light or no edits</option>
                  <option value="no">No, heavy rework</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Cost (£)</span>
                <input name="cost" type="number" min={0} step="0.01" placeholder="Model / tool spend" className={inputClass} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Errors found</span>
                <input name="errors" type="number" min={0} defaultValue={0} className={inputClass} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Notes</span>
                <input name="notes" maxLength={2000} className={inputClass} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="serious_error" className="accent-fp-pink" /> A serious error (would have reached a client or broken something)
            </label>
            <div>
              <button type="submit" className={secondaryButton}>
                Log test
              </button>
            </div>
          </form>
          {runs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-fp-mid">
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Task</th>
                    <th className="py-2 pr-3">Stage</th>
                    <th className="py-2 pr-3 text-right">By hand</th>
                    <th className="py-2 pr-3 text-right">Agent</th>
                    <th className="py-2 pr-3">Usable</th>
                    <th className="py-2 pr-3 text-right">Errors</th>
                    <th className="py-2 pr-3 text-right">Cost</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-fp-border align-top">
                      <td className="whitespace-nowrap py-2 pr-3">{longDate(r.run_date)}</td>
                      <td className="py-2 pr-3">
                        {r.task}
                        {r.notes && <span className="block text-xs text-fp-mid">{r.notes}</span>}
                        <span className="block text-xs text-fp-mid">{r.logged_by ? nameOf.get(r.logged_by) ?? "" : ""}</span>
                      </td>
                      <td className="py-2 pr-3">{aiStageLabel(r.stage)}</td>
                      <td className="py-2 pr-3 text-right">{r.manual_minutes ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">{r.agent_minutes ?? "—"}</td>
                      <td className="py-2 pr-3">{r.usable === null ? "—" : r.usable ? "Yes" : "No"}</td>
                      <td className="py-2 pr-3 text-right">
                        {r.errors}
                        {r.serious_error && <Badge tone="red">serious</Badge>}
                      </td>
                      <td className="py-2 pr-3 text-right">{r.cost === null ? "—" : money(Number(r.cost))}</td>
                      <td className="py-2 text-right">
                        {(r.logged_by === user.id || user.isAdmin) && (
                          <form action={deleteTestRun.bind(null, p.id, r.id)}>
                            <ConfirmSubmit message="Delete this test?" className="text-xs font-semibold text-fp-error hover:underline">
                              Delete
                            </ConfirmSubmit>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-fp-mid">No tests logged yet. Log each real task the agent is tried on, with the time it takes by hand as the baseline.</p>
          )}
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section id="updates">
          <Card title={`Updates (${(updates ?? []).length})`}>
            <form action={addUpdate.bind(null, p.id)} className="mb-4 grid gap-2">
              <label className="sr-only" htmlFor="update-body">
                Add an update
              </label>
              <textarea id="update-body" name="body" rows={3} required maxLength={5000} placeholder="What happened, what was learned, what's next…" className={inputClass} />
              <div>
                <button type="submit" className={secondaryButton}>
                  Add update
                </button>
              </div>
            </form>
            {(updates ?? []).length > 0 ? (
              <ul className="grid gap-3">
                {(updates ?? []).map((u) => (
                  <li key={u.id} className="rounded-md bg-fp-offwhite p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-fp-mid">
                      <span>
                        <strong className="text-fp-dark">{u.author_id ? nameOf.get(u.author_id) ?? "Someone" : "Someone"}</strong> · {shortDateTime(u.created_at)}
                      </span>
                      {(u.author_id === user.id || user.isAdmin) && (
                        <form action={deleteUpdate.bind(null, p.id, u.id)}>
                          <ConfirmSubmit message="Delete this update?" className="text-xs font-semibold text-fp-error hover:underline">
                            Delete
                          </ConfirmSubmit>
                        </form>
                      )}
                    </div>
                    <p className="whitespace-pre-line">{u.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fp-mid">No updates yet.</p>
            )}
          </Card>
        </section>

        <div className="grid content-start gap-6">
          <Card title="Details">
            <ProjectForm action={saveProject.bind(null, p.id)} people={pickable} values={p} submitLabel="Save changes" />
          </Card>
          {user.isAdmin && (
            <form action={deleteProject.bind(null, p.id)}>
              <ConfirmSubmit message={`Delete ${p.title} with its scorecard, tests and updates?`} className={dangerButton}>
                Delete project
              </ConfirmSubmit>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

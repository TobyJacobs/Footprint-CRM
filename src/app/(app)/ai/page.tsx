import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Notice, primaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { loadPeople } from "@/lib/design/jobs";
import { loadProjects } from "@/lib/ai/data";
import { DECISIONS_DATE, LAUNCH_DATE, aiStageLabel, daysBetween, decisionLabel, decisionTone, hoursMinutes } from "@/lib/ai/options";
import { longDate } from "@/lib/customers/display";
import { ukToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { ProgressBar, ScoreDots, Stat } from "./parts";

export const metadata: Metadata = { title: "FootprintAI" };

// Every agent and system, with its progress, scorecard and live figures.
export default async function AiProjectsPage(props: PageProps<"/ai">) {
  await requirePermission("ai", "view");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [projects, { nameOf }] = await Promise.all([loadProjects(supabase), loadPeople(supabase)]);
  const today = ukToday();
  const toDecisions = daysBetween(today, DECISIONS_DATE);
  const toLaunch = daysBetween(today, LAUNCH_DATE);
  const agents = projects.filter((p) => p.kind === "agent");
  const minutesSaved = projects.reduce((t, p) => t + p.figures.minutesSaved, 0);
  const tests = projects.reduce((t, p) => t + p.figures.tests, 0);
  const passedAll = agents.filter((p) => p.scores.length > 0 && p.scores.every((s) => s.status === "pass")).length;

  return (
    <div className="grid gap-6">
      <Notice searchParams={sp} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Scorecard decisions" value={toDecisions >= 0 ? `${toDecisions} days` : "Done"} hint={longDate(DECISIONS_DATE) ?? undefined} />
        <Stat label="Full launch" value={toLaunch >= 0 ? `${toLaunch} days` : "Launched"} hint={longDate(LAUNCH_DATE) ?? undefined} />
        <Stat label="Agents passing every row" value={`${passedAll} of ${agents.length}`} hint="Only these join the launch catalogue" />
        <Stat label="Time saved so far" value={hoursMinutes(minutesSaved)} hint={`From ${tests} logged test${tests === 1 ? "" : "s"}`} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-black">Agents and systems</h2>
        <Link href="/ai/new" className={`${primaryButton} inline-flex items-center gap-2`}>
          <Plus size={16} aria-hidden /> Add a project
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-fp-mid">Nothing here yet.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/ai/${p.id}`} className="grid gap-3 rounded-lg border border-fp-border bg-white p-5 hover:border-fp-pink/40">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-fp-mid">
                      {p.kind === "agent" ? "Agent" : p.kind === "system" ? "System" : "Project"}
                      {p.wave ? ` · ${p.wave}` : ""}
                      {p.owner_id ? ` · ${nameOf.get(p.owner_id) ?? "—"}` : " · No owner yet"}
                    </p>
                    <h3 className="font-bold">{p.title}</h3>
                  </div>
                  <div className="flex gap-1">
                    <Badge tone={p.stage === "live" ? "teal" : p.stage === "on_hold" ? "grey" : "amber"}>{aiStageLabel(p.stage)}</Badge>
                    {p.decision && <Badge tone={decisionTone(p.decision)}>{decisionLabel(p.decision)}</Badge>}
                  </div>
                </div>
                <ProgressBar stage={p.stage} compact />
                <ScoreDots scores={p.scores} />
                <p className="text-xs text-fp-mid">
                  {p.figures.tests === 0
                    ? "No tests logged yet"
                    : `${p.figures.tests} test${p.figures.tests === 1 ? "" : "s"} · ${hoursMinutes(p.figures.minutesSaved)} saved${
                        p.figures.usablePct !== null ? ` · ${p.figures.usablePct}% usable` : ""
                      }${p.figures.seriousErrors ? ` · ${p.figures.seriousErrors} serious error${p.figures.seriousErrors === 1 ? "" : "s"}` : ""}`}
                </p>
                {p.next_step && <p className="text-sm"><span className="font-semibold">Next:</span> {p.next_step}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { liveFigures, type TestRun } from "./options";

export type AiProject = {
  id: string;
  title: string;
  kind: string;
  summary: string | null;
  owner_id: string | null;
  wave: string | null;
  stage: string;
  decision: string | null;
  pilot_job: string | null;
  tools: string | null;
  human_check: string | null;
  next_step: string | null;
  start_date: string | null;
  decision_date: string | null;
  updated_at: string;
};

export type Score = { criterion: string; status: string; evidence: string | null; updated_at: string; updated_by: string | null };

const PROJECT_COLUMNS =
  "id, title, kind, summary, owner_id, wave, stage, decision, pilot_job, tools, human_check, next_step, start_date, decision_date, updated_at";
const RUN_COLUMNS = "project_id, manual_minutes, agent_minutes, usable, errors, serious_error, cost";

const toRun = (r: Record<string, unknown>): TestRun => ({
  manual_minutes: r.manual_minutes as number | null,
  agent_minutes: r.agent_minutes as number | null,
  usable: r.usable as boolean | null,
  errors: Number(r.errors ?? 0),
  serious_error: Boolean(r.serious_error),
  cost: r.cost === null ? null : Number(r.cost),
});

// Every project with its scorecard and live figures, in the brief's order.
export async function loadProjects(supabase: SupabaseClient) {
  const [{ data: projects }, { data: scores }, { data: runs }] = await Promise.all([
    supabase.from("ai_projects").select(PROJECT_COLUMNS).order("position").order("created_at"),
    supabase.from("ai_scores").select("project_id, criterion, status"),
    supabase.from("ai_test_runs").select(RUN_COLUMNS),
  ]);
  return (projects ?? []).map((p) => ({
    ...(p as AiProject),
    scores: (scores ?? []).filter((s) => s.project_id === p.id).map((s) => ({ criterion: s.criterion as string, status: s.status as string })),
    figures: liveFigures((runs ?? []).filter((r) => r.project_id === p.id).map(toRun)),
  }));
}

export { toRun };

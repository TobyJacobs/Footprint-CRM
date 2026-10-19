// Shared lists and helpers for FootprintAI (brief: "Footprint AI Roadmap",
// Mitch, 14 October 2026).

type Tone = "grey" | "teal" | "pink" | "amber" | "red";

// Key dates from the brief.
export const DECISIONS_DATE = "2026-12-18"; // scorecard decisions
export const LAUNCH_DATE = "2027-01-19"; // full launch

export const aiKinds = [
  { value: "agent", label: "Agent" },
  { value: "system", label: "System" },
  { value: "project", label: "Project" },
] as const;

// The path an agent takes: shadow (drafts, nobody uses it) → assisted (a person
// edits and approves) → supervised (acts, a person spot-checks) → live.
export const aiStages = [
  { value: "planned", label: "Planned", help: "Not started testing yet." },
  { value: "shadow", label: "Shadow", help: "The agent drafts; nobody uses the output yet." },
  { value: "assisted", label: "Assisted", help: "A person edits and approves everything." },
  { value: "supervised", label: "Supervised", help: "The agent acts; a person spot-checks." },
  { value: "live", label: "Live", help: "In everyday use." },
  { value: "on_hold", label: "On hold", help: "Paused." },
] as const;
export const isAiStage = (v: unknown): v is (typeof aiStages)[number]["value"] => aiStages.some((s) => s.value === v);
export const aiStageLabel = (s: string | null) => aiStages.find((x) => x.value === s)?.label ?? "—";

// The steps shown on the progress bar (on hold sits outside it).
export const progressSteps = ["planned", "shadow", "assisted", "supervised", "live"] as const;
export function progressIndex(stage: string) {
  const i = progressSteps.indexOf(stage as (typeof progressSteps)[number]);
  return i < 0 ? 0 : i;
}

export const aiDecisions = [
  { value: "scale", label: "Scale (make it a product)" },
  { value: "fix", label: "Fix (retest after launch)" },
  { value: "stop", label: "Stop (internal tool or drop)" },
] as const;
export const isAiDecision = (v: unknown): v is (typeof aiDecisions)[number]["value"] => aiDecisions.some((d) => d.value === v);
export const decisionLabel = (d: string | null) => (d === "scale" ? "Scale" : d === "fix" ? "Fix" : d === "stop" ? "Stop" : null);
export const decisionTone = (d: string | null): Tone => (d === "scale" ? "teal" : d === "fix" ? "amber" : d === "stop" ? "red" : "grey");

// The brief's agent test scorecard. An agent moves on only when every row passes.
export const criteria = [
  { value: "quality", label: "Quality", how: "Owner scores a sample of outputs against a written checklist", pass: "Most sampled outputs usable with light edits" },
  { value: "time_saved", label: "Time saved", how: "Task time with the agent versus the baseline", pass: "Clear, repeatable saving after review time is counted" },
  { value: "errors", label: "Errors", how: "Factual, brand or technical mistakes found in review, logged per output", pass: "No serious errors reaching a client; minor ones trending down" },
  { value: "cost", label: "Cost", how: "Model and tool spend per task versus the cost of the person's time", pass: "Cheaper than the manual route" },
  { value: "safety", label: "Safety", how: "No client data used outside the AI policy; no unapproved sends", pass: "Zero breaches" },
  { value: "adoption", label: "Adoption", how: "Team actually uses it unprompted for the task", pass: "Owner confirms they would keep it" },
  { value: "repeatability", label: "Repeatability", how: "Works for at least two different clients or projects, not one", pass: "Yes, with little rework" },
] as const;
export const isCriterion = (v: unknown): v is (typeof criteria)[number]["value"] => criteria.some((c) => c.value === v);

export const scoreStatuses = [
  { value: "not_started", label: "Not started" },
  { value: "on_track", label: "On track" },
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
] as const;
export const isScoreStatus = (v: unknown): v is (typeof scoreStatuses)[number]["value"] => scoreStatuses.some((s) => s.value === v);
export const scoreLabel = (s: string) => scoreStatuses.find((x) => x.value === s)?.label ?? s;
export const scoreTone = (s: string): Tone => (s === "pass" ? "teal" : s === "fail" ? "red" : s === "on_track" ? "amber" : "grey");

export type TestRun = {
  manual_minutes: number | null;
  agent_minutes: number | null;
  usable: boolean | null;
  errors: number;
  serious_error: boolean;
  cost: number | null;
};

// The live figures from a project's test log.
export function liveFigures(runs: TestRun[]) {
  const timed = runs.filter((r) => r.manual_minutes !== null && r.agent_minutes !== null);
  const minutesSaved = timed.reduce((t, r) => t + (r.manual_minutes! - r.agent_minutes!), 0);
  const manualMinutes = timed.reduce((t, r) => t + r.manual_minutes!, 0);
  const judged = runs.filter((r) => r.usable !== null);
  const usable = judged.filter((r) => r.usable).length;
  const costed = runs.filter((r) => r.cost !== null);
  const cost = costed.reduce((t, r) => t + Number(r.cost), 0);
  return {
    tests: runs.length,
    minutesSaved,
    savedPct: manualMinutes > 0 ? Math.round((minutesSaved / manualMinutes) * 100) : null,
    usablePct: judged.length ? Math.round((usable / judged.length) * 100) : null,
    errors: runs.reduce((t, r) => t + r.errors, 0),
    seriousErrors: runs.filter((r) => r.serious_error).length,
    cost: costed.length ? Math.round(cost * 100) / 100 : null,
    costPerTest: costed.length ? Math.round((cost / costed.length) * 100) / 100 : null,
  };
}

// "3h 20m" from minutes (negative = time lost).
export function hoursMinutes(mins: number) {
  const sign = mins < 0 ? "−" : "";
  const m = Math.abs(Math.round(mins));
  const h = Math.floor(m / 60);
  return `${sign}${h ? `${h}h ` : ""}${m % 60}m`;
}

// Whole days from one plain date to another (negative = in the past).
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

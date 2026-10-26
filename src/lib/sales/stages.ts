import { gbp } from "@/lib/customers/display";
import { designStageLabel } from "@/lib/design/options";

// The stages a quote or sales order moves through, worked out from what has
// actually happened (owner, 26 October 2026), for the stage bars and the
// Operations dashboard. Nobody sets them by hand.

export type StageState = "done" | "current" | "skipped" | "todo" | "stopped";
export type Stage = { label: string; note: string | null; done: boolean };
export type Stages = { stages: Stage[]; states: StageState[] };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Steps an order didn't need (e.g. no design) are "skipped" once a later step
// is done; the current stage is the one after the last step done.
function lightUp(stages: Stage[], stopped: boolean): Stages {
  const lastDone = stages.reduce((last, s, i) => (s.done ? i : last), 0);
  const states = stages.map((s, i): StageState =>
    s.done ? "done" : i < lastDone ? "skipped" : i === lastDone + 1 ? (stopped ? "stopped" : "current") : "todo",
  );
  return { stages, states };
}

// Design counts as done once every job is approved or further on.
const DESIGN_DONE = ["approved", "production", "done"];

export function orderStages(o: {
  status: string;
  project: { number: string } | null;
  designJobs: { stage: string }[];
  poCount: number;
  invoices: { number: string }[];
  invoicedNet: number;
  orderNet: number;
}): Stages {
  const designDone = o.designJobs.length > 0 && o.designJobs.every((j) => DESIGN_DONE.includes(j.stage));
  const openJob = o.designJobs.find((j) => !DESIGN_DONE.includes(j.stage));
  const partInvoiced = o.status !== "invoiced" && o.invoices.length > 0;
  return lightUp(
    [
      { label: "Order received", note: null, done: true },
      { label: "Project", note: o.project?.number ?? null, done: !!o.project },
      {
        label: "Design",
        note: o.designJobs.length === 0 ? null : openJob ? `${plural(o.designJobs.length, "job")} · ${designStageLabel(openJob.stage)}` : `${plural(o.designJobs.length, "job")} approved`,
        done: designDone,
      },
      { label: "Suppliers ordered", note: o.poCount ? plural(o.poCount, "PO") : null, done: o.poCount > 0 },
      { label: "Completed", note: null, done: ["completed", "invoiced"].includes(o.status) },
      {
        label: "Invoiced",
        note: partInvoiced ? `Part invoiced: ${gbp(o.invoicedNet)} of ${gbp(o.orderNet)}` : o.invoices.map((i) => i.number).join(", ") || null,
        done: o.status === "invoiced",
      },
    ],
    o.status === "cancelled",
  );
}

// Quotes: Draft → Sent → Accepted → Sales order. A declined quote stops at
// "Accepted", shown as declined.
export function quoteStages(q: { status: string; orderNumber: string | null }): Stages {
  const sent = ["sent", "accepted", "declined", "converted"].includes(q.status);
  const declined = q.status === "declined";
  return lightUp(
    [
      { label: "Draft", note: null, done: true },
      { label: "Sent", note: null, done: sent },
      { label: declined ? "Declined" : "Accepted", note: declined ? "The customer said no" : null, done: ["accepted", "converted"].includes(q.status) },
      { label: "Sales order", note: q.orderNumber, done: q.status === "converted" },
    ],
    declined,
  );
}

// The stage an order is at now, for lists (e.g. "Design").
export const currentStage = (s: Stages) => s.stages[s.states.findIndex((x) => x === "current" || x === "stopped")]?.label ?? "Invoiced";

import { gbp } from "@/lib/customers/display";
import { designStageLabel } from "@/lib/design/options";

// The stages a quote or sales order moves through, worked out from what has
// actually happened (owner, 26 October 2026), for the stage bars and the
// Operations dashboard. Nobody sets them by hand.

export type StageState = "done" | "current" | "skipped" | "todo" | "stopped";
// href: the step opens that record (e.g. the sales order made from a quote).
// tone: an extra colour for the step (owner, 11 November 2026): "pending" =
// amber, under way but not finished (waiting for the customer, goods not in
// yet, not all paid); "complete" = green, fully finished (goods received, all
// paid). Other finished steps stay the usual blue.
// skip: the step isn't needed for this record (e.g. "No project needed").
export type Stage = { label: string; note: string | null; done: boolean; href?: string | null; tone?: "pending" | "complete"; skip?: boolean };
export type Stages = { stages: Stage[]; states: StageState[] };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Steps an order didn't need (e.g. no design) are "skipped" once a later step
// is done; the current stage is the one after the last step done.
// A step marked "skip" is "skipped" straight away and counts as passed. A step
// that's under way but not finished (tone "pending") is never "not needed":
// it shows as in progress (amber) wherever it is, even if an earlier step isn't
// finished (owner, 11 November 2026).
function lightUp(stages: Stage[], stopped: boolean): Stages {
  const lastDone = stages.reduce((last, s, i) => (s.done || s.skip ? i : last), 0);
  const states = stages.map((s, i): StageState =>
    s.done
      ? "done"
      : s.tone === "pending"
        ? "current"
        : s.skip || i < lastDone
          ? "skipped"
          : i === lastDone + 1
            ? stopped
              ? "stopped"
              : "current"
            : "todo",
  );
  return { stages, states };
}

// Design counts as done once every job is approved or further on.
const DESIGN_DONE = ["approved", "production", "done"];

export function orderStages(o: {
  status: string;
  project: { number: string; status?: string } | null;
  // "No project needed" ticked on the order (DJ, 11 November 2026).
  projectNotNeeded?: boolean;
  designJobs: { stage: string }[];
  // The order's purchase orders (status) and invoices (status: paid or not).
  pos: { status: string }[];
  invoices: { number: string; status?: string }[];
  invoicedNet: number;
  orderNet: number;
}): Stages {
  const designDone = o.designJobs.length > 0 && o.designJobs.every((j) => DESIGN_DONE.includes(j.stage));
  const openJob = o.designJobs.find((j) => !DESIGN_DONE.includes(j.stage));
  const partInvoiced = o.status !== "invoiced" && o.invoices.length > 0;
  // Purchasing (called "Suppliers ordered" until 12 November 2026; owner, 11 November 2026): amber once ordered, green once every
  // purchase order's goods are in. Drafts don't count as ordered.
  const livePos = o.pos.filter((p) => p.status !== "cancelled");
  const orderedPos = livePos.filter((p) => ["sent", "received", "closed"].includes(p.status));
  const receivedPos = livePos.filter((p) => ["received", "closed"].includes(p.status));
  const allReceived = orderedPos.length > 0 && receivedPos.length === livePos.length;
  const draftPos = livePos.length - orderedPos.length;
  // Invoices: amber while part invoiced or not all paid; green when all paid.
  const paidCount = o.invoices.filter((i) => i.status === "paid").length;
  const allPaid = o.status === "invoiced" && o.invoices.length > 0 && paidCount === o.invoices.length;
  return lightUp(
    [
      { label: "Order received", note: null, done: true },
      // Amber while the project is still open (active or on hold); blue once completed.
      {
        label: "Project",
        note: o.project ? `${o.project.number}${o.project.status === "on_hold" ? " · on hold" : ""}` : null,
        done: !!o.project,
        skip: !o.project && !!o.projectNotNeeded,
        tone: o.project && ["active", "on_hold"].includes(o.project.status ?? "") ? "pending" : undefined,
      },
      {
        label: "Design",
        note: o.designJobs.length === 0 ? null : openJob ? `${plural(o.designJobs.length, "job")} · ${designStageLabel(openJob.stage)}` : `${plural(o.designJobs.length, "job")} approved`,
        done: designDone,
        // Amber while design jobs are under way.
        tone: openJob ? "pending" : undefined,
      },
      orderedPos.length === 0
        ? { label: "Purchasing", note: draftPos ? `${plural(draftPos, "draft PO")}` : null, done: false }
        : allReceived
          ? { label: "Purchasing", note: "Goods received", done: true, tone: "complete" }
          : {
              label: "Purchasing",
              note: `Waiting for goods · ${receivedPos.length} of ${livePos.length} received`,
              done: true,
              tone: "pending",
            },
      // Called "In production" (DJ, 11 November 2026); ticked once the order is marked completed.
      { label: "In production", note: null, done: ["completed", "invoiced"].includes(o.status) },
      {
        label: allPaid ? "Paid" : "Invoiced",
        note: partInvoiced
          ? `Part invoiced: ${gbp(o.invoicedNet)} of ${gbp(o.orderNet)}${paidCount ? ` · ${paidCount} of ${o.invoices.length} paid` : ""}`
          : o.status === "invoiced" && !allPaid
            ? `${paidCount} of ${plural(o.invoices.length, "invoice")} paid`
            : o.invoices.map((i) => i.number).join(", ") || null,
        done: o.status === "invoiced",
        tone: partInvoiced || (o.status === "invoiced" && !allPaid) ? "pending" : allPaid ? "complete" : undefined,
      },
    ],
    o.status === "cancelled",
  );
}

// Quotes: Draft → Sent → Accepted → Sales order. A declined quote stops at
// "Accepted", shown as declined.
export function quoteStages(q: { status: string; orderNumber: string | null; orderId?: string | null }): Stages {
  const sent = ["sent", "accepted", "declined", "converted"].includes(q.status);
  const declined = q.status === "declined";
  return lightUp(
    [
      { label: "Draft", note: null, done: true },
      { label: "Sent", note: null, done: sent },
      // Sent and waiting: amber "Pending acceptance"; once accepted:
      // "Accepted", blue like the other steps (owner, 11 November 2026).
      declined
        ? { label: "Declined", note: "The customer said no", done: false }
        : ["accepted", "converted"].includes(q.status)
          ? { label: "Accepted", note: null, done: true }
          : q.status === "sent"
            ? { label: "Pending acceptance", note: "Waiting for the customer", done: false, tone: "pending" }
            : { label: "Accepted", note: null, done: false },
      // Opens the order (DJ, 9 November 2026).
      { label: "Sales order", note: q.orderNumber, done: q.status === "converted", href: q.orderId ? `/sales/${q.orderId}` : null },
    ],
    declined,
  );
}

// Purchase orders (DJ, 11 November 2026): Raised → Ordered (amber while the
// goods are awaited) → Goods received → Bill checked (green once closed).
// A cancelled PO stops where it got to.
export function poStages(po: { status: string; orderedVia?: string | null; tracking?: boolean; shortLines?: number }): Stages {
  const ordered = ["sent", "received", "closed"].includes(po.status);
  const received = ["received", "closed"].includes(po.status);
  return lightUp(
    [
      { label: "Raised", note: null, done: true },
      {
        label: "Ordered",
        note: po.status === "sent" ? `Waiting for goods${po.tracking ? " · tracking added" : ""}` : (po.orderedVia ?? null),
        done: ordered,
        tone: po.status === "sent" ? "pending" : undefined,
      },
      {
        label: "Goods received",
        note: received && po.shortLines ? `${po.shortLines} line${po.shortLines === 1 ? "" : "s"} short` : null,
        done: received,
        tone: received && po.shortLines ? "pending" : undefined,
      },
      { label: "Bill checked", note: po.status === "closed" ? "Closed" : null, done: po.status === "closed", tone: po.status === "closed" ? "complete" : undefined },
    ],
    po.status === "cancelled",
  );
}

// The stage an order is at now, for lists (e.g. "Design").
export const currentStage = (s: Stages) => s.stages[s.states.findIndex((x) => x === "current" || x === "stopped")]?.label ?? "Invoiced";

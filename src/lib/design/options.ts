// Shared lists and helpers for Design Workload.

type Tone = "grey" | "teal" | "pink" | "amber" | "red";

// In the order a job normally moves through them.
export const designStages = [
  { value: "todo", label: "To do" },
  { value: "in_design", label: "In design" },
  { value: "with_customer", label: "With customer" },
  { value: "amends", label: "Amends" },
  { value: "approved", label: "Approved" },
  { value: "production", label: "Sent to production" },
  { value: "done", label: "Done" },
] as const;

export type DesignStage = (typeof designStages)[number]["value"];

export const isDesignStage = (v: unknown): v is DesignStage => designStages.some((s) => s.value === v);

export const designStageLabel = (s: string) => designStages.find((x) => x.value === s)?.label ?? s;

export function designStageTone(s: string): Tone {
  if (s === "done") return "teal";
  if (s === "approved" || s === "production") return "teal";
  if (s === "with_customer") return "amber";
  if (s === "amends") return "pink";
  return "grey";
}

// The usual next step from each stage, for the one-click button on a job.
export const nextStage: Partial<Record<DesignStage, DesignStage>> = {
  todo: "in_design",
  in_design: "with_customer",
  with_customer: "approved",
  amends: "with_customer",
  approved: "production",
  production: "done",
};

// Whole days since a moment (0 = today), e.g. "3 days at this stage".
export function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

export const jobNumber = (n: number | string) => `DJ-${n}`;

// What a designer may upload: proofs are images or PDFs, up to 25 MB.
export const DESIGN_FILE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"];
export const DESIGN_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const DESIGN_BUCKET = "design-files";

// How long a customer's proof approval link (and its file link) works.
export const APPROVAL_LINK_DAYS = 30;

export const approvalStatusLabel: Record<string, string> = {
  waiting: "Waiting for customer",
  approved: "Approved",
  changes: "Changes requested",
  withdrawn: "Withdrawn",
};

export const isPast = (iso: string) => new Date(iso).getTime() < Date.now();

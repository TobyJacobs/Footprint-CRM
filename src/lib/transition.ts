import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ukToday } from "@/lib/dates";

// The FootprintAI transition tracker (DJ's spec, 28 October 2026). Four
// workstreams, Wednesday meeting weeks, gates and actions. Who sees what is
// enforced by the database (see the transition_tracker migration); this file
// loads it and works out weeks and overdue items.

export type TransitionAccess = "full" | "member" | "owner";
export type ActionStatus = "not_started" | "in_progress" | "blocked" | "done";

export type Stream = { key: string; name: string; subtitle: string | null; description: string | null; sort: number };
export type Phase = { number: number; name: string; label: string | null };
export type Week = { number: number; meeting_date: string; label: string; phase: number | null };
export type Gate = { id: string; name: string; date: string; description: string | null; is_launch: boolean };
export type Person = { id: string; name: string; is_member: boolean };
export type Action = {
  id: string;
  ref: string;
  phase: number | null;
  stream: string;
  title: string;
  detail: string | null;
  owner_id: string | null;
  due_date: string;
  status: ActionStatus;
  visibility: "all" | "board";
  notes: string | null;
  sort: number;
  completed_at: string | null;
  updated_at: string;
};

// One colour per stream, used everywhere (from the brand, violet added).
export const streamColours: Record<string, { c: string; tint: string }> = {
  platform: { c: "#2a9ea0", tint: "#e3f4f4" },
  workforce: { c: "#d81b6a", tint: "#fbe5ee" },
  proposition: { c: "#e8811a", tint: "#fcefe1" },
  people: { c: "#6b4fd8", tint: "#ece8fb" },
};
export const streamColour = (key: string) => streamColours[key] ?? { c: "#888888", tint: "#f2f2f2" };

export const statusLabels: Record<ActionStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};
export const statusTone = (s: ActionStatus) =>
  (s === "done" ? "teal" : s === "in_progress" ? "amber" : s === "blocked" ? "red" : "grey") as "teal" | "amber" | "red" | "grey";
export const isStatus = (v: unknown): v is ActionStatus => typeof v === "string" && v in statusLabels;

// The week an action falls in: the first meeting Wednesday on or after its
// due date (anything after the last one goes in the last week).
export function weekOf(date: string, weeks: Week[]): Week | null {
  return weeks.find((w) => w.meeting_date >= date) ?? weeks[weeks.length - 1] ?? null;
}
// "This week": the next meeting Wednesday on or after today.
export const currentWeek = (weeks: Week[]) => weekOf(ukToday(), weeks);

const day = (d: string) => new Date(`${d}T12:00:00Z`);
export const meetingLabel = (d: string) =>
  day(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const shortDay = (d: string) => day(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const weekShort = (w: Week, last: boolean) => (last && w.number > 8 ? "After Christmas" : `Week ${w.number}`);

// How many meeting weeks an open action is past its due date (0 = not overdue).
export function weeksOverdue(a: Action, week: Week | null, weeks: Week[]): number {
  if (a.status === "done" || !week) return 0;
  const due = weekOf(a.due_date, weeks);
  return due && due.number < week.number ? week.number - due.number : 0;
}

export type TransitionData = {
  access: TransitionAccess;
  // While an admin previews another role, board-only actions are hidden here
  // too (the database still sees the admin).
  hidesBoard: boolean;
  streams: Stream[];
  phases: Phase[];
  weeks: Week[];
  gates: Gate[];
  actions: Action[];
  people: Person[];
  myDirectoryId: string | null;
};

export async function loadTransition(access: TransitionAccess, previewRole: { name: string } | null): Promise<TransitionData> {
  await connection();
  const supabase = await createClient();
  const [streams, phases, weeks, gates, actions, people, me] = await Promise.all([
    supabase.from("transition_streams").select("*").order("sort"),
    supabase.from("transition_phases").select("*").order("number"),
    supabase.from("transition_weeks").select("*").order("number"),
    supabase.from("transition_gates").select("*").order("date"),
    supabase.from("transition_actions").select("*").order("due_date").order("sort"),
    supabase.rpc("transition_people"),
    supabase.rpc("_my_directory_id"),
  ]);
  const hidesBoard = !!previewRole && previewRole.name !== "Directors";
  return {
    access: hidesBoard && access === "full" ? "member" : access,
    hidesBoard,
    streams: (streams.data ?? []) as Stream[],
    phases: (phases.data ?? []) as Phase[],
    weeks: (weeks.data ?? []) as Week[],
    gates: (gates.data ?? []) as Gate[],
    actions: ((actions.data ?? []) as Action[]).filter((a) => !(hidesBoard && a.visibility === "board")),
    people: (people.data ?? []) as Person[],
    myDirectoryId: (me.data as string | null) ?? null,
  };
}

// Can this person change everything about an action, or only its status and notes?
export const canEditFully = (d: Pick<TransitionData, "access">, a: Action) =>
  d.access === "full" || (d.access === "member" && a.visibility === "all");
export const canUpdate = (d: Pick<TransitionData, "access" | "myDirectoryId">, a: Action) =>
  canEditFully(d, a) || (!!d.myDirectoryId && a.owner_id === d.myDirectoryId);

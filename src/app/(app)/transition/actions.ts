"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { str } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { isStatus } from "@/lib/transition";

// The transition tracker. Every action runs as the signed-in person, so the
// database decides what they may change (see the transition_tracker migration).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Only ever go back to a Transition page.
const safeBack = (v: string | null) => (v && /^\/transition(\/|\?|$)/.test(v) && !v.startsWith("//") ? v : "/transition");
const withParam = (path: string, q: string) => `${path}${path.includes("?") ? "&" : "?"}${q}`;

async function need() {
  const user = await getCurrentUser();
  if (!user.transitionAccess) redirect("/?error=forbidden");
  return user;
}
function fail(back: string, message: string): never {
  redirect(withParam(back, `error=${encodeURIComponent(message)}`));
}
function done(back: string): never {
  revalidatePath("/transition", "layout");
  revalidatePath("/");
  redirect(back);
}

// Status from the inline picker (This week, All actions, the side panel).
export async function setActionStatus(id: string, fd: FormData) {
  await need();
  const back = safeBack(str(fd, "back"));
  const status = str(fd, "status");
  if (!isStatus(status)) fail(back, "Unknown status");
  const supabase = await createClient();
  const { data, error } = await supabase.from("transition_actions").update({ status }).eq("id", id).select("id");
  if (error) fail(back, error.message);
  if (!data?.length) fail(back, "You can't change that action");
  done(back);
}

// The side panel and the Add action form. Owners only send status and notes;
// everyone else can change everything they're allowed to.
export async function saveAction(id: string | null, fd: FormData) {
  const user = await need();
  const back = safeBack(str(fd, "back"));
  const supabase = await createClient();

  const fields: Record<string, unknown> = { notes: str(fd, "notes") };
  const status = str(fd, "status");
  if (status) {
    if (!isStatus(status)) fail(back, "Unknown status");
    fields.status = status;
  }
  if (str(fd, "full") === "1") {
    const title = str(fd, "title");
    const dueDate = str(fd, "due_date");
    const stream = str(fd, "stream");
    if (!title || !dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !stream) fail(back, "Please give a title, stream and due date");
    const owner = str(fd, "owner_id");
    Object.assign(fields, {
      title: title.slice(0, 300),
      detail: str(fd, "detail")?.slice(0, 5000) ?? null,
      stream,
      owner_id: owner && UUID_RE.test(owner) ? owner : null,
      due_date: dueDate,
      // Only directors and admins make an action board-only.
      ...(user.transitionAccess === "full" ? { visibility: str(fd, "visibility") === "board" ? "board" : "all" } : {}),
    });
  }

  if (!id) {
    // Next free reference, T-041 and so on.
    const { data: last } = await supabase.from("transition_actions").select("ref").order("ref", { ascending: false }).limit(1);
    const n = Number(String(last?.[0]?.ref ?? "T-000").slice(2)) + 1;
    const { data: weeks } = await supabase.from("transition_weeks").select("number, meeting_date, phase").order("number");
    const due = String(fields.due_date);
    const week = (weeks ?? []).find((w) => w.meeting_date >= due) ?? weeks?.[weeks.length - 1];
    const { error } = await supabase
      .from("transition_actions")
      .insert({ ...fields, ref: `T-${String(n).padStart(3, "0")}`, phase: week?.phase ?? null, sort: 1000 + n });
    if (error) fail(back, error.message);
    done(withParam(back, "saved=1"));
  }

  const { data, error } = await supabase.from("transition_actions").update(fields).eq("id", id).select("id");
  if (error) fail(back, error.message);
  if (!data?.length) fail(back, "You can't change that action");
  done(withParam(back, "saved=1"));
}

export async function deleteAction(id: string, fd: FormData) {
  const user = await need();
  const back = safeBack(str(fd, "back"));
  if (user.transitionAccess !== "full") fail(back, "Only directors and admins can delete actions");
  const supabase = await createClient();
  const { error } = await supabase.from("transition_actions").delete().eq("id", id);
  if (error) fail(back, error.message);
  done(withParam(back.replace(/([?&])open=[^&]*/, "$1").replace(/[?&]$/, ""), "deleted=1"));
}

export async function addActionUpdate(id: string, fd: FormData) {
  await need();
  const back = safeBack(str(fd, "back"));
  const body = str(fd, "body");
  if (!body) fail(back, "Please write an update");
  const supabase = await createClient();
  const { error } = await supabase.from("transition_action_updates").insert({ action_id: id, body: body.slice(0, 2000) });
  if (error) fail(back, error.message);
  done(back);
}

// The invite list (directors and admins).
export async function addMember(fd: FormData) {
  await need();
  const id = str(fd, "directory_id");
  if (!id || !UUID_RE.test(id)) fail("/transition/people", "Choose a person");
  const supabase = await createClient();
  const { error } = await supabase.from("transition_members").insert({ directory_id: id });
  if (error) fail("/transition/people", error.message);
  done("/transition/people?saved=1");
}

export async function removeMember(id: string) {
  await need();
  const supabase = await createClient();
  const { error } = await supabase.from("transition_members").delete().eq("directory_id", id);
  if (error) fail("/transition/people", error.message);
  done("/transition/people?saved=1");
}

// Remember the register's filters for this person (a cookie on their browser).
export async function rememberFilters(query: string) {
  (await cookies()).set("fp_transition_filters", query.slice(0, 500), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/transition",
    maxAge: 60 * 60 * 24 * 180,
  });
}

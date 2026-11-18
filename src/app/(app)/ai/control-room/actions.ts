"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requirePermission } from "@/lib/auth";
import { isEngine, isSkill } from "@/lib/ai/bot-tools";
import { stepRun, type RunBot, type StepOutcome } from "@/lib/ai/control-room";
import { str } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// The AI control room (owner, 18 November 2026). Everything runs as the
// signed-in person, so the database's own rules apply too.

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ask an in-house bot to do something: starts a run and opens it.
export async function startRun(fd: FormData) {
  await requirePermission("ai", "view");
  const botId = str(fd, "bot_id");
  const request = str(fd, "request")?.slice(0, 4000);
  if (!botId || !UUID_RE.test(botId)) fail("/ai/control-room", "Please choose a bot");
  if (!request) fail("/ai/control-room", "Please say what you'd like the bot to do");
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("ai_bot_runs")
    .insert({ bot_id: botId, request, requested_by: user.user?.id })
    .select("id")
    .single();
  if (error) fail("/ai/control-room", "That bot can't be asked from here (it may be switched off or an outside bot)");
  revalidatePath("/ai/control-room");
  redirect(`/ai/control-room/runs/${data.id}`);
}

// One step of the person's own run (the run page calls this until it's done).
export async function continueRun(runId: string): Promise<StepOutcome> {
  await requirePermission("ai", "view");
  if (!UUID_RE.test(runId)) return { status: "failed", reply: "Unknown run" };
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { data: run } = await supabase
    .from("ai_bot_runs")
    .select("id, request, conversation, turns, status, requested_by, source, ai_bots(name, engine, model, instructions, skills)")
    .eq("id", runId)
    .single();
  if (!run || run.requested_by !== user.user?.id || run.source !== "control_room") return { status: "failed", reply: "Only the person who asked can run this" };
  if (run.status !== "running") return { status: run.status as StepOutcome["status"] };
  const bot = run.ai_bots as unknown as RunBot | null;
  if (!bot || (bot.engine !== "claude" && bot.engine !== "grok")) return { status: "failed", reply: "Unknown bot" };
  return stepRun(supabase, { id: run.id, request: run.request, conversation: (run.conversation as unknown[]) ?? [], turns: run.turns }, bot);
}

export async function stopRun(runId: string) {
  await requirePermission("ai", "view");
  if (!UUID_RE.test(runId)) return;
  const supabase = await createClient();
  await supabase
    .from("ai_bot_runs")
    .update({ status: "stopped", reply: "Stopped by the person who asked.", finished_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("status", "running");
  revalidatePath(`/ai/control-room/runs/${runId}`);
}

// ─── Bots (admins) ──────────────────────────────────────────────────────────

export async function saveBot(botId: string | null, fd: FormData) {
  await requireAdmin();
  const back = botId ? `/ai/control-room/bots/${botId}` : "/ai/control-room/bots";
  const name = str(fd, "name")?.slice(0, 80);
  const engine = str(fd, "engine");
  if (!name) fail(back, "Please give the bot a name");
  if (!isEngine(engine)) fail(back, "Please choose an engine");
  const skills = fd.getAll("skills").filter(isSkill);
  const project = str(fd, "ai_project_id");
  const fields = {
    name,
    engine,
    model: engine === "outside" ? null : (str(fd, "model")?.slice(0, 80) ?? null),
    skills,
    instructions: str(fd, "instructions")?.slice(0, 4000) ?? null,
    ai_project_id: project && UUID_RE.test(project) ? project : null,
    active: fd.get("active") === "on",
  };
  const supabase = await createClient();
  if (botId) {
    const { error } = await supabase.from("ai_bots").update(fields).eq("id", botId);
    if (error) fail(back, error.message);
  } else {
    const { data, error } = await supabase.from("ai_bots").insert(fields).select("id").single();
    if (error) fail(back, error.message);
    botId = data.id;
  }
  revalidatePath("/ai/control-room", "layout");
  redirect(`/ai/control-room/bots/${botId}?saved=1`);
}

// A new key for an outside bot. It's shown once: only its fingerprint is kept.
export async function makeBotKey(botId: string): Promise<{ key?: string; error?: string }> {
  await requireAdmin();
  if (!UUID_RE.test(botId)) return { error: "Unknown bot" };
  const key = `fpbot_${randomBytes(32).toString("base64url")}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_ai_bot_key", { p_bot: botId, p_key: key });
  if (error) return { error: error.message };
  revalidatePath(`/ai/control-room/bots/${botId}`);
  return { key };
}

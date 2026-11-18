"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { isEngine, isSafeWebhookUrl, isSkill, type ChatLine } from "@/lib/ai/bot-tools";
import { chatReply, stepRun, type RunBot, type StepOutcome } from "@/lib/ai/control-room";
import { loadPeople } from "@/lib/design/jobs";
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
  if (error) fail("/ai/control-room", "That bot can't be asked from here (it may be switched off, or an outside bot without a web address)");
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
    .select("id, request, conversation, turns, status, requested_by, source, ai_bots(id, name, engine, model, instructions, skills, webhook_url)")
    .eq("id", runId)
    .single();
  if (!run || run.requested_by !== user.user?.id || run.source !== "control_room") return { status: "failed", reply: "Only the person who asked can run this" };
  if (run.status !== "running") return { status: run.status as StepOutcome["status"] };
  const bot = run.ai_bots as unknown as RunBot | null;
  if (!bot) return { status: "failed", reply: "Unknown bot" };
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

// ─── Bots (every FootprintAI member; owners and admins change them) ─────────

export async function saveBot(botId: string | null, fd: FormData) {
  await requirePermission("ai", "view");
  const back = botId ? `/ai/control-room/bots/${botId}` : "/ai/control-room/bots";
  const name = str(fd, "name")?.slice(0, 80);
  const engine = str(fd, "engine");
  if (!name) fail(back, "Please give the bot a name");
  if (!isEngine(engine)) fail(back, "Please choose an engine");
  const webhook = engine === "outside" ? (str(fd, "webhook_url") ?? null) : null;
  if (webhook && !isSafeWebhookUrl(webhook)) fail(back, "The web address must start https:// and be a public address");
  const skills = fd.getAll("skills").filter(isSkill);
  const project = str(fd, "ai_project_id");
  const fields = {
    name,
    engine,
    description: str(fd, "description")?.slice(0, 300) ?? null,
    model: engine === "outside" ? null : (str(fd, "model")?.slice(0, 80) ?? null),
    webhook_url: webhook,
    skills,
    instructions: engine === "outside" ? null : (str(fd, "instructions")?.slice(0, 4000) ?? null),
    ai_project_id: project && UUID_RE.test(project) ? project : null,
    active: fd.get("active") === "on",
  };
  const supabase = await createClient();
  if (botId) {
    const { data, error } = await supabase.from("ai_bots").update(fields).eq("id", botId).select("id");
    if (error) fail(back, error.message);
    if (!data?.length) fail(back, "Only the bot's owner or an admin can change it");
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
  await requirePermission("ai", "view");
  if (!UUID_RE.test(botId)) return { error: "Unknown bot" };
  const key = `fpbot_${randomBytes(32).toString("base64url")}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_ai_bot_key", { p_bot: botId, p_key: key });
  if (error) return { error: error.message };
  revalidatePath(`/ai/control-room/bots/${botId}`);
  return { key };
}

// ─── Group chats ────────────────────────────────────────────────────────────

export async function startChat(fd: FormData) {
  await requirePermission("ai", "view");
  const back = "/ai/control-room/chats/new";
  const title = str(fd, "title")?.slice(0, 120);
  const body = str(fd, "body")?.slice(0, 8000);
  const botIds = [...new Set(fd.getAll("bot_ids").map(String).filter((v) => UUID_RE.test(v)))].slice(0, 6);
  if (!title) fail(back, "Please give the chat a name");
  if (botIds.length < 2) fail(back, "Please choose at least two bots");
  if (!body) fail(back, "Please write the first message");
  const supabase = await createClient();
  const { data: chat, error } = await supabase.from("ai_chats").insert({ title }).select("id").single();
  if (error) fail(back, error.message);
  const { error: botsError } = await supabase.from("ai_chat_bots").insert(botIds.map((bot_id, position) => ({ chat_id: chat.id, bot_id, position })));
  if (botsError) fail(back, "One of those bots can't join (it may be switched off)");
  const { data: user } = await supabase.auth.getUser();
  await supabase.from("ai_chat_messages").insert({ chat_id: chat.id, author_id: user.user?.id, body });
  revalidatePath("/ai/control-room");
  redirect(`/ai/control-room/chats/${chat.id}?talk=1`);
}

export async function postChatMessage(chatId: string, fd: FormData) {
  await requirePermission("ai", "view");
  if (!UUID_RE.test(chatId)) return;
  const body = str(fd, "body")?.slice(0, 8000);
  if (!body) return;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from("ai_chat_messages").insert({ chat_id: chatId, author_id: user.user?.id, body });
  if (error) fail(`/ai/control-room/chats/${chatId}`, "Your message couldn't be posted");
  await supabase.from("ai_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
  revalidatePath(`/ai/control-room/chats/${chatId}`);
}

// One bot's turn in a group chat: it reads the chat so far and replies.
export async function botTurn(chatId: string, botId: string): Promise<{ ok: boolean; error?: string }> {
  await requirePermission("ai", "view");
  if (!UUID_RE.test(chatId) || !UUID_RE.test(botId)) return { ok: false, error: "Unknown chat" };
  const supabase = await createClient();
  const [{ data: chat }, { data: members }, { data: messages }, { nameOf }] = await Promise.all([
    supabase.from("ai_chats").select("id, title").eq("id", chatId).maybeSingle(),
    supabase.from("ai_chat_bots").select("bot_id, ai_bots(id, name, engine, model, instructions, skills, webhook_url, active)").eq("chat_id", chatId),
    supabase.from("ai_chat_messages").select("author_id, bot_id, body, created_at").eq("chat_id", chatId).order("created_at", { ascending: false }).limit(40),
    loadPeople(supabase),
  ]);
  if (!chat) return { ok: false, error: "Chat not found" };
  const bots = (members ?? []).map((m) => m.ai_bots as unknown as RunBot & { active: boolean }).filter(Boolean);
  const bot = bots.find((b) => b.id === botId);
  if (!bot) return { ok: false, error: "That bot isn't in this chat" };
  if (!bot.active) return { ok: false, error: `${bot.name} is switched off` };
  const botName = new Map(bots.map((b) => [b.id, b.name]));
  const lines: ChatLine[] = (messages ?? [])
    .reverse()
    .map((m) => ({ from: m.bot_id ? (botName.get(m.bot_id) ?? "A bot") : `${nameOf.get(m.author_id ?? "") ?? "Someone"} (person)`, body: m.body }));
  let reply: string;
  try {
    reply = await chatReply(bot, chat, bots.filter((b) => b.id !== bot.id).map((b) => b.name), lines);
  } catch (e) {
    return { ok: false, error: `${bot.name} didn't answer: ${e instanceof Error ? e.message.slice(0, 200) : "unknown problem"}` };
  }
  const { error } = await supabase.from("ai_chat_messages").insert({ chat_id: chatId, bot_id: bot.id, body: reply });
  if (error) return { ok: false, error: "The reply couldn't be saved" };
  await supabase.from("ai_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
  return { ok: true };
}

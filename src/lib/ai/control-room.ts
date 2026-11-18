import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { longDate } from "@/lib/customers/display";
import { ukToday } from "@/lib/dates";
import { MAX_TURNS, botRules, chatRules, chatTranscript, defaultModel, toolsFor, type BotTool, type ChatLine } from "./bot-tools";
import { callOutsideBot } from "./outside-bots";

// The AI control room's engines (owner, 18 November 2026): runs an in-house
// bot one step at a time (one reply from Claude or Grok, then the tools it
// asked for), so each step is quick and the page shows progress as it goes.
// The keys live only in Netlify: ANTHROPIC_API_KEY for Claude bots and
// XAI_API_KEY for Grok bots. Tools are done by the database as the person who
// asked (ai_bot_tool), which checks what the bot may do and logs each step.

export const engineReady = { claude: () => !!process.env.ANTHROPIC_API_KEY, grok: () => !!process.env.XAI_API_KEY };

export type RunBot = {
  id: string;
  name: string;
  engine: "claude" | "grok" | "outside";
  model: string | null;
  instructions: string | null;
  skills: string[];
  webhook_url: string | null;
};
export type RunRow = { id: string; request: string; conversation: unknown[]; turns: number };
export type StepOutcome = { status: "running" | "done" | "failed" | "stopped"; reply?: string };

type ToolCall = { id: string; name: string; input: unknown };

// Does one tool through the database; errors go back to the bot so it can try again.
async function runTool(supabase: SupabaseClient, runId: string, call: ToolCall): Promise<{ content: string; isError: boolean }> {
  if (!call.input || typeof call.input !== "object" || Array.isArray(call.input)) {
    return { content: "The tool's details weren't valid JSON: please try again.", isError: true };
  }
  const { data, error } = await supabase.rpc("ai_bot_tool", { p_run: runId, p_tool: call.name, p_input: call.input });
  if (error) return { content: error.message.slice(0, 500), isError: true };
  return { content: JSON.stringify(data ?? null).slice(0, 12000), isError: false };
}

// The newer Claude models take an effort setting and can hand a declined
// request to another Claude model on the server ("fallbacks").
const isCurrentClaude = (model: string) => /^claude-(opus|sonnet|haiku|fable)-5/.test(model);
const takesFallbacks = (model: string) => ["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"].includes(model);

async function claudeStep(supabase: SupabaseClient, run: RunRow, bot: RunBot, system: string, tools: BotTool[]) {
  const model = bot.model?.trim() || defaultModel.claude;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 50_000, maxRetries: 1 });
  const messages = (run.conversation.length ? run.conversation : [{ role: "user", content: run.request }]) as Anthropic.Beta.BetaMessageParam[];
  const response = await client.beta.messages.create({
    model,
    max_tokens: 8000,
    system,
    tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
    messages,
    ...(isCurrentClaude(model) ? { output_config: { effort: "medium" as const } } : {}),
    ...(takesFallbacks(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });

  // Keep everything Claude sent (including its thinking) for the next step.
  const conversation: Anthropic.Beta.BetaMessageParam[] = [...messages, { role: "assistant", content: response.content as Anthropic.Beta.BetaContentBlockParam[] }];
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();

  if (response.stop_reason === "tool_use") {
    const calls = response.content.flatMap((b) => (b.type === "tool_use" ? [{ id: b.id, name: b.name, input: b.input }] : []));
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      const r = await runTool(supabase, run.id, call);
      results.push({ type: "tool_result", tool_use_id: call.id, content: r.content, ...(r.isError ? { is_error: true } : {}) });
    }
    conversation.push({ role: "user", content: results });
    return { conversation, outcome: { status: "running" } as StepOutcome };
  }
  if (response.stop_reason === "pause_turn") return { conversation, outcome: { status: "running" } as StepOutcome };
  if (response.stop_reason === "refusal") {
    return { conversation, outcome: { status: "failed", reply: "Claude declined this request. Please reword it, or do it by hand." } as StepOutcome };
  }
  if (response.stop_reason === "max_tokens") {
    return { conversation, outcome: { status: "failed", reply: "The bot's answer was too long and was cut off. Please try a smaller request." } as StepOutcome };
  }
  return { conversation, outcome: { status: "done", reply: text || "Done." } as StepOutcome };
}

type GrokMessage = {
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

async function grokStep(supabase: SupabaseClient, run: RunRow, bot: RunBot, system: string, tools: BotTool[]) {
  const messages = (run.conversation.length ? run.conversation : [{ role: "user", content: run.request }]) as GrokMessage[];
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` },
    body: JSON.stringify({
      model: bot.model?.trim() || process.env.XAI_MODEL || defaultModel.grok,
      temperature: 0.2,
      max_tokens: 2000,
      messages: [{ role: "system", content: system }, ...messages],
      tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
      tool_choice: "auto",
    }),
    signal: AbortSignal.timeout(50_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Grok said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: GrokMessage; finish_reason?: string }[] };
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("Grok sent an empty answer");

  const conversation: GrokMessage[] = [
    ...messages,
    { role: "assistant", content: message.content ?? null, ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}) },
  ];
  if (message.tool_calls?.length) {
    for (const tc of message.tool_calls) {
      let input: unknown = null;
      try {
        input = JSON.parse(tc.function.arguments || "{}");
      } catch {
        input = null;
      }
      const r = await runTool(supabase, run.id, { id: tc.id, name: tc.function.name, input });
      conversation.push({ role: "tool", tool_call_id: tc.id, content: r.isError ? `Error: ${r.content}` : r.content });
    }
    return { conversation, outcome: { status: "running" } as StepOutcome };
  }
  return { conversation, outcome: { status: "done", reply: (message.content ?? "").trim() || "Done." } as StepOutcome };
}

// One step of a run: saves the conversation and, when it ends, the reply.
export async function stepRun(supabase: SupabaseClient, run: RunRow, bot: RunBot): Promise<StepOutcome> {
  const finish = async (outcome: StepOutcome, conversation?: unknown[]) => {
    await supabase
      .from("ai_bot_runs")
      .update({
        ...(conversation ? { conversation } : {}),
        turns: run.turns + 1,
        status: outcome.status,
        ...(outcome.status === "running" ? {} : { reply: (outcome.reply ?? "").slice(0, 8000), finished_at: new Date().toISOString() }),
      })
      .eq("id", run.id);
    return outcome;
  };

  if (run.turns >= MAX_TURNS) return finish({ status: "stopped", reply: `Stopped after ${MAX_TURNS} steps without finishing. Please check any drafts it made.` });
  // An outside bot gets the request at its own address and answers in one go
  // (it can use its tools on this run with its key while it works).
  if (bot.engine === "outside") {
    try {
      const reply = await callOutsideBot(bot, {
        type: "run",
        run_id: run.id,
        request: run.request,
        bot: { id: bot.id, name: bot.name },
        tools: "Send tools to /api/control-room with your key and this run_id. Drafts only.",
      });
      return finish({ status: "done", reply });
    } catch (e) {
      return finish({ status: "failed", reply: `${bot.name} didn't answer: ${e instanceof Error ? e.message.slice(0, 200) : "unknown problem"}` });
    }
  }
  if (!engineReady[bot.engine]()) {
    return finish({ status: "failed", reply: `${bot.engine === "claude" ? "Claude" : "Grok"} isn't connected yet: an admin needs to add its key in Netlify.` });
  }
  const tools = toolsFor(bot.skills);
  const system = botRules(bot.name, longDate(ukToday()) ?? ukToday(), bot.instructions);
  try {
    const { conversation, outcome } = await (bot.engine === "claude" ? claudeStep : grokStep)(supabase, run, bot as RunBot & { engine: "claude" | "grok" }, system, tools);
    return finish(outcome, conversation);
  } catch (e) {
    const reason =
      e instanceof Anthropic.RateLimitError
        ? "Claude is busy (rate limited). Please try again in a minute."
        : e instanceof Anthropic.AuthenticationError
          ? "Claude didn't accept the key in Netlify."
          : e instanceof Anthropic.APIError
            ? `Claude couldn't answer (${e.status ?? "no connection"}).`
            : `The bot couldn't answer: ${e instanceof Error ? e.message.slice(0, 200) : "unknown problem"}`;
    console.error("Control room:", reason, e instanceof Error ? e.message : e);
    return finish({ status: "failed", reply: reason });
  }
}

// A bot's next message in a group chat (no tools: bots only talk there).
export async function chatReply(bot: RunBot, chat: { id: string; title: string }, others: string[], lines: ChatLine[]): Promise<string> {
  const recent = lines.slice(-40);
  if (bot.engine === "outside") {
    return callOutsideBot(bot, {
      type: "chat",
      chat_id: chat.id,
      title: chat.title,
      you: bot.name,
      others,
      messages: recent.map((l) => ({ from: l.from, text: l.body })),
    });
  }
  if (!engineReady[bot.engine]()) throw new Error(`${bot.engine === "claude" ? "Claude" : "Grok"} isn't connected yet (its key needs adding in Netlify)`);
  const system = chatRules(bot.name, others, chat.title, longDate(ukToday()) ?? ukToday(), bot.instructions);
  const prompt = `The chat so far:\n\n${chatTranscript(recent)}\n\nWrite ${bot.name}'s next message (just the message, without your name in front).`;
  if (bot.engine === "claude") {
    const model = bot.model?.trim() || defaultModel.claude;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 50_000, maxRetries: 1 });
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: prompt }],
      ...(isCurrentClaude(model) ? { output_config: { effort: "low" as const } } : {}),
      ...(takesFallbacks(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (response.stop_reason === "refusal") throw new Error("Claude declined to answer");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (!text) throw new Error("Claude sent an empty answer");
    return stripName(text, bot.name);
  }
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` },
    body: JSON.stringify({
      model: bot.model?.trim() || process.env.XAI_MODEL || defaultModel.grok,
      temperature: 0.5,
      max_tokens: 600,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(50_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Grok said ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("Grok sent an empty answer");
  return stripName(text, bot.name);
}

// Bots sometimes start with their own name ("Design bot: ..."): take it off.
const stripName = (text: string, name: string) =>
  text.replace(new RegExp(`^\\s*\\**${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\**\\s*:\\s*`, "i"), "").slice(0, 8000);

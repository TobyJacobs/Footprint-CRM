import { BOT_SKILLS, finishTool } from "@/lib/ai/bot-tools";
import { createClient } from "@/lib/supabase/server";

// The AI control room's door for outside bots (owner, 18 November 2026).
// An outside bot sends one tool at a time with its key; the database checks
// the key and what the bot may do, does the tool and logs it. Bots can only
// make drafts. GET lists the tools (no key needed: it's only their shapes).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function GET() {
  return json({ tools: [...BOT_SKILLS.flatMap((s) => s.tools), finishTool] });
}

export async function POST(request: Request) {
  const key = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (key.length < 32 || key.length > 200) return json({ error: "Missing or wrong key" }, 401);
  const raw = await request.text();
  if (raw.length > 100_000) return json({ error: "Too big" }, 413);
  let body: { run_id?: unknown; request?: unknown; tool?: unknown; input?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ error: "The body must be JSON" }, 400);
  }
  const runId = typeof body.run_id === "string" && UUID_RE.test(body.run_id) ? body.run_id : null;
  if (body.run_id && !runId) return json({ error: "Unknown run_id" }, 400);
  if (typeof body.tool !== "string" || !body.tool) return json({ error: "Please say which tool" }, 400);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("outside_bot_tool", {
    p_key: key,
    p_run: runId,
    p_request: typeof body.request === "string" ? body.request.slice(0, 4000) : null,
    p_tool: body.tool.slice(0, 60),
    p_input: body.input && typeof body.input === "object" && !Array.isArray(body.input) ? body.input : {},
  });
  if (error) {
    const status = error.message === "Not allowed" ? 401 : error.message === "Too many requests" ? 429 : 400;
    return json({ error: error.message.slice(0, 500) }, status);
  }
  return json(data);
}

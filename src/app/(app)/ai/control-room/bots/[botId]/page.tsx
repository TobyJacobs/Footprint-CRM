import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { finishTool, toolsFor } from "@/lib/ai/bot-tools";
import { longDate } from "@/lib/customers/display";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { saveBot } from "../../actions";
import BotForm from "../BotForm";
import KeyMaker from "./KeyMaker";

export const metadata: Metadata = { title: "Bot · Control room" };

// One bot (admins): its settings and, for an outside bot, its key and how to
// connect it.
export default async function BotPage(props: PageProps<"/ai/control-room/bots/[botId]">) {
  await requireAdmin();
  const { botId } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(botId)) notFound();
  const supabase = await createClient();
  const [{ data: bot }, { data: agents }, { data: hints }, site] = await Promise.all([
    supabase.from("ai_bots").select("id, name, engine, model, skills, instructions, ai_project_id, active").eq("id", botId).maybeSingle(),
    supabase.from("ai_projects").select("id, title").order("title"),
    supabase.rpc("ai_bot_key_hints"),
    siteUrl(),
  ]);
  if (!bot) notFound();
  const hint = ((hints ?? []) as { bot_id: string; hint: string; created_at: string }[]).find((h) => h.bot_id === bot.id);
  const tools = [...toolsFor(bot.skills), finishTool];

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/ai/control-room/bots" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Bots
      </Link>
      <h2 className="text-2xl font-black">{bot.name}</h2>
      <Notice searchParams={sp} />
      <Card title="Settings">
        <BotForm action={saveBot.bind(null, bot.id)} values={bot} agents={agents ?? []} submitLabel="Save" />
      </Card>

      {bot.engine === "outside" && (
        <>
          <Card title="Key">
            <p className="mb-3 text-sm">
              {hint ? `This bot has a key ending …${hint.hint}, made ${longDate(hint.created_at)}.` : "This bot has no key yet, so it can't connect."}
            </p>
            <KeyMaker botId={bot.id} hasKey={!!hint} />
          </Card>
          <Card title="How to connect it">
            <div className="grid gap-3 text-sm">
              <p>
                The outside bot (for example a Claude or Grok bot someone already uses) sends each tool it wants to use to FootprintOS. Give whoever
                looks after it this address, the key, and the tools below. Everything it does is logged in the control room, and it can only make
                drafts.
              </p>
              <code className="block break-all rounded-md border border-fp-border bg-fp-offwhite p-3 text-xs">
                POST {site}/api/control-room
                <br />
                Authorization: Bearer YOUR_KEY
                <br />
                {`{ "request": "what the person asked", "tool": "find_customers", "input": { "query": "riverside" } }`}
              </code>
              <p>
                The answer includes a <code>run_id</code>: send it with each later tool in the same job (instead of <code>request</code>), and end with
                the <code>finish</code> tool. The full tool list, in the format Claude and Grok use, is at <code>GET {site}/api/control-room</code>.
              </p>
              <ul className="grid gap-1">
                {tools.map((t) => (
                  <li key={t.name}>
                    <code className="font-bold">{t.name}</code> <span className="text-fp-mid">· {t.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { engineLabel, finishTool, toolsFor, type BotEngine } from "@/lib/ai/bot-tools";
import { botKeyName, botReady } from "@/lib/ai/control-room";
import { signingSecret } from "@/lib/ai/outside-bots";
import { longDate } from "@/lib/customers/display";
import { loadPeople } from "@/lib/design/jobs";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { saveBot } from "../../actions";
import BotForm from "../BotForm";
import KeyMaker from "./KeyMaker";
import { Pane } from "../../parts";

export const metadata: Metadata = { title: "Bot · Control room" };

// One bot: its settings (its owner and admins can change them) and, for an
// outside bot, its key and how to connect it.
export default async function BotPage(props: PageProps<"/ai/control-room/bots/[botId]">) {
  const user = await requirePermission("ai", "view");
  const { botId } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(botId)) notFound();
  const supabase = await createClient();
  const [{ data: bot }, { data: agents }, { data: hints }, site, { nameOf }] = await Promise.all([
    supabase
      .from("ai_bots")
      .select("id, name, description, engine, model, skills, instructions, ai_project_id, active, owner_id, webhook_url, key_name")
      .eq("id", botId)
      .maybeSingle(),
    supabase.from("ai_projects").select("id, title").order("title"),
    supabase.rpc("ai_bot_key_hints"),
    siteUrl(),
    loadPeople(supabase),
  ]);
  if (!bot) notFound();
  const canEdit = user.isAdmin || bot.owner_id === user.id;
  const hint = ((hints ?? []) as { bot_id: string; hint: string; created_at: string }[]).find((h) => h.bot_id === bot.id);
  const tools = [...toolsFor(bot.skills), finishTool];
  const secret = canEdit && bot.engine === "outside" ? signingSecret(bot.id) : null;

  return (
    <Pane>
      <Link href="/ai/control-room/bots" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Bots
      </Link>
      <div>
        <h2 className="text-2xl font-black">{bot.name}</h2>
        <p className="text-sm text-fp-mid">
          {engineLabel[bot.engine as BotEngine]} · Owner: {bot.owner_id ? (nameOf.get(bot.owner_id) ?? "—") : "Footprint"}
          {bot.engine !== "outside" && (
            <>
              {" "}
              · Key: <code>{botKeyName(bot)}</code>
              {bot.key_name ? " (its own)" : " (the company key)"}{" "}
              {botReady(bot) ? <span className="text-fp-teal-deep">in Netlify ✓</span> : <span className="text-fp-error">not in Netlify yet</span>}
            </>
          )}
        </p>
      </div>
      <Notice searchParams={sp} />
      {canEdit ? (
        <Card title="Settings">
          <BotForm action={saveBot.bind(null, bot.id)} values={bot} agents={agents ?? []} submitLabel="Save" canQuote={user.can("quotes", "edit")} isAdmin={user.isAdmin} />
        </Card>
      ) : (
        <Card title="About this bot">
          <div className="grid gap-2 text-sm">
            {bot.description && <p>{bot.description}</p>}
            <p className="text-fp-mid">
              {bot.skills.length ? `It can do: ${bot.skills.join(", ")} (drafts only).` : "It can talk in the control room and group chats."} Only its owner or an
              admin can change it.
            </p>
          </div>
        </Card>
      )}

      {bot.engine === "outside" && canEdit && (
        <>
          <Card title="Key">
            <p className="mb-3 text-sm">
              {hint ? `This bot has a key ending …${hint.hint}, made ${longDate(hint.created_at)}.` : "This bot has no key yet, so it can't use FootprintOS's tools."}
            </p>
            <KeyMaker botId={bot.id} hasKey={!!hint} />
          </Card>
          <Card title="How to connect it">
            <div className="grid gap-3 text-sm">
              <p className="font-semibold">1. Let people use it from here (needs the bot&apos;s own web address)</p>
              <p>
                When someone asks this bot in the control room or a group chat, FootprintOS sends a POST to its web address with JSON:{" "}
                <code>{`{ "type": "run", "run_id", "request" }`}</code> or <code>{`{ "type": "chat", "chat_id", "title", "you", "others", "messages" }`}</code>. It
                must answer within 45 seconds with <code>{`{ "reply": "..." }`}</code>.
              </p>
              <p>
                Each message is signed so the bot can check it came from FootprintOS: the <code>X-FootprintOS-Signature</code> header is{" "}
                <code>sha256=</code> followed by the HMAC-SHA256 of <code>timestamp.body</code> (the timestamp is in <code>X-FootprintOS-Timestamp</code>),
                using this signing secret:
              </p>
              {secret ? (
                <code className="block break-all rounded-md border border-fp-border bg-fp-offwhite p-3 text-xs">{secret}</code>
              ) : (
                <p className="text-fp-error">The signing key isn&apos;t set up in Netlify yet.</p>
              )}
              <p className="font-semibold">2. Let it use FootprintOS&apos;s tools (needs the key above)</p>
              <code className="block break-all rounded-md border border-fp-border bg-fp-offwhite p-3 text-xs">
                POST {site}/api/control-room
                <br />
                Authorization: Bearer YOUR_KEY
                <br />
                {`{ "request": "what the person asked", "tool": "find_customers", "input": { "query": "riverside" } }`}
              </code>
              <p>
                The answer includes a <code>run_id</code>: send it with each later tool in the same job (when FootprintOS sent the job, use its{" "}
                <code>run_id</code>). End your own jobs with the <code>finish</code> tool. The full tool list, in the format Claude and Grok use, is at{" "}
                <code>GET {site}/api/control-room</code>. Keep the key and secret private, like passwords.
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
    </Pane>
  );
}

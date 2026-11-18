import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Field, Notice, inputClass, primaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { engineLabel, type BotEngine } from "@/lib/ai/bot-tools";
import { engineReady } from "@/lib/ai/control-room";
import { shortDateTime } from "@/lib/customers/display";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { startRun } from "./actions";
import { RunStatus } from "./parts";

export const metadata: Metadata = { title: "Control room" };

// The AI control room (owner, 18 November 2026): ask the team's bots to do
// things, see what each one did, and connect outside bots.
export default async function ControlRoomPage(props: PageProps<"/ai/control-room">) {
  await requirePermission("ai", "view");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: bots }, { data: runs }, { nameOf }] = await Promise.all([
    supabase.from("ai_bots").select("id, name, engine, model, skills, active, description, webhook_url, owner_id").order("name"),
    supabase
      .from("ai_bot_runs")
      .select("id, request, status, source, requested_by, created_at, draft_ids, ai_bots(name)")
      .order("created_at", { ascending: false })
      .limit(30),
    loadPeople(supabase),
  ]);
  const { data: chats } = await supabase
    .from("ai_chats")
    .select("id, title, created_by, updated_at, ai_chat_bots(ai_bots(name))")
    .order("updated_at", { ascending: false })
    .limit(15);
  const inHouse = (bots ?? []).filter((b) => b.active && (b.engine === "claude" || b.engine === "grok" || b.webhook_url));
  const ready = (b: { engine: string; webhook_url: string | null }) =>
    b.engine === "claude" ? engineReady.claude() : b.engine === "grok" ? engineReady.grok() : !!b.webhook_url;
  const notReady = [...new Set(inHouse.filter((b) => b.engine !== "outside" && !ready(b)).map((b) => b.engine as "claude" | "grok"))];

  return (
    <div className="grid gap-6">
      <Notice searchParams={sp} />

      <Card title="Ask a bot">
        {inHouse.length === 0 ? (
          <p className="text-sm text-fp-mid">No bots are switched on yet. Connect one under Bots below.</p>
        ) : (
          <form action={startRun} className="grid gap-4">
            <Field label="Bot">
              <select name="bot_id" required defaultValue={inHouse[0].id} className={inputClass}>
                {inHouse.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({engineLabel[b.engine as BotEngine]})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="What would you like it to do?" hint="For example: Quote Riverside Bakery for 1,000 A5 leaflets, double-sided, same as last time.">
              <textarea name="request" rows={3} required maxLength={4000} className={inputClass} />
            </Field>
            <p className="text-xs text-fp-mid">
              Bots only make drafts. Nothing goes to a customer until you&apos;ve checked it and sent it yourself.
            </p>
            {notReady.length > 0 && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {notReady.map((e) => (e === "claude" ? "Claude" : "Grok")).join(" and ")} isn&apos;t connected yet: an admin needs to add{" "}
                {notReady.map((e) => (e === "claude" ? "ANTHROPIC_API_KEY" : "XAI_API_KEY")).join(" and ")} in Netlify.
              </p>
            )}
            <div>
              <button className={primaryButton}>Ask the bot</button>
            </div>
          </form>
        )}
      </Card>

      <Card
        title="Group chats"
        action={
          <Link href="/ai/control-room/chats/new" className="text-sm font-semibold text-fp-teal-deep hover:underline">
            New group chat →
          </Link>
        }
      >
        {(chats ?? []).length === 0 ? (
          <p className="text-sm text-fp-mid">Put two or more bots in a chat, for example an account manager and a design bot, and let them talk it through.</p>
        ) : (
          <ul className="divide-y divide-fp-border">
            {(chats ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/ai/control-room/chats/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-fp-offwhite">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.title}</span>
                  <span className="text-xs text-fp-mid">
                    {(c.ai_chat_bots as unknown as { ai_bots: { name: string } | null }[]).map((x) => x.ai_bots?.name).filter(Boolean).join(", ")} ·{" "}
                    {shortDateTime(c.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Recent runs">
        {(runs ?? []).length === 0 ? (
          <p className="text-sm text-fp-mid">No runs yet.</p>
        ) : (
          <ul className="divide-y divide-fp-border">
            {(runs ?? []).map((r) => (
              <li key={r.id}>
                <Link href={`/ai/control-room/runs/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-fp-offwhite">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.request}</span>
                  <span className="text-xs text-fp-mid">
                    {(r.ai_bots as unknown as { name: string } | null)?.name ?? "Bot"} ·{" "}
                    {r.source === "outside" ? "outside bot" : (nameOf.get(r.requested_by ?? "") ?? "—")} · {shortDateTime(r.created_at)}
                  </span>
                  {r.draft_ids.length > 0 && <Badge tone="teal">{r.draft_ids.length === 1 ? "1 draft" : `${r.draft_ids.length} drafts`}</Badge>}
                  <RunStatus status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Bots"
        action={
          <Link href="/ai/control-room/bots" className="text-sm font-semibold text-fp-teal-deep hover:underline">
            Connect or manage bots →
          </Link>
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {(bots ?? []).map((b) => (
            <li key={b.id} className="rounded-md border border-fp-border p-4">
              <Link href={`/ai/control-room/bots/${b.id}`} className="font-bold hover:underline">
                {b.name}
              </Link>
              {b.description && <p className="text-sm">{b.description}</p>}
              <p className="text-xs text-fp-mid">
                {engineLabel[b.engine as BotEngine]}
                {b.model ? ` · ${b.model}` : ""} · {b.skills.length ? b.skills.join(", ") : "talks only"} ·{" "}
                {b.owner_id ? (nameOf.get(b.owner_id) ?? "—") : "Footprint"}
              </p>
              <div className="mt-2 flex gap-2">
                {!b.active ? (
                  <Badge>Switched off</Badge>
                ) : ready(b) ? (
                  <Badge tone="teal">Ready</Badge>
                ) : b.engine === "outside" ? (
                  <Badge>Calls in only</Badge>
                ) : (
                  <Badge tone="amber">Needs its key</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

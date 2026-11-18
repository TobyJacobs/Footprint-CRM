import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, FileText, MessagesSquare, Send, Zap } from "lucide-react";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { engineLabel, type BotEngine } from "@/lib/ai/bot-tools";
import { botKeyName, botReady } from "@/lib/ai/control-room";
import { shortDateTime } from "@/lib/customers/display";
import { ukToday } from "@/lib/dates";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { startRun } from "./actions";
import { BotAvatar, Pane, RunStatus, StatusLight } from "./parts";

export const metadata: Metadata = { title: "Control room" };

// The AI control room (owner, 18 November 2026): ask the team's bots to do
// things, see what each one did, and connect outside bots.
export default async function ControlRoomPage(props: PageProps<"/ai/control-room">) {
  await requirePermission("ai", "view");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: bots }, { data: runs }, { count: chatCount }, { nameOf }] = await Promise.all([
    supabase.from("ai_bots").select("id, name, engine, model, skills, active, description, webhook_url, owner_id, key_name").order("name"),
    supabase
      .from("ai_bot_runs")
      .select("id, request, status, source, requested_by, created_at, draft_ids, ai_bots(name, engine)")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("ai_chats").select("id", { count: "exact", head: true }),
    loadPeople(supabase),
  ]);
  const all = bots ?? [];
  const ready = (b: (typeof all)[number]) => (b.engine === "outside" ? !!b.webhook_url : botReady(b));
  const askable = all.filter((b) => b.active && (b.engine === "claude" || b.engine === "grok" || b.webhook_url));
  const notReady = askable.filter((b) => b.engine !== "outside" && !ready(b));
  const wanted = typeof sp.bot === "string" ? sp.bot : null;
  const chosen = askable.find((b) => b.id === wanted) ?? askable.find(ready) ?? askable[0];

  const today = ukToday();
  const recent = runs ?? [];
  const runsToday = recent.filter((r) => r.created_at.slice(0, 10) === today).length;
  const drafts = recent.reduce((n, r) => n + r.draft_ids.length, 0);
  const stats = [
    { label: "Bots online", value: `${all.filter((b) => b.active && ready(b)).length}/${all.length}`, icon: Bot },
    { label: "Runs today", value: String(runsToday), icon: Zap },
    { label: "Drafts made (last 30 runs)", value: String(drafts), icon: FileText },
    { label: "Group chats", value: String(chatCount ?? 0), icon: MessagesSquare },
  ];

  return (
    <Pane wide>
      <Notice searchParams={sp} />

      {/* Ask a bot */}
      <section className="relative overflow-hidden rounded-2xl bg-fp-black p-5 text-white shadow-xl sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-fp-pink/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-fp-orange/20 blur-3xl" aria-hidden />
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-fp-pink-light">&gt; New job</p>
          <h3 className="mt-1 text-2xl font-black sm:text-3xl">What needs doing?</h3>
          {askable.length === 0 ? (
            <p className="mt-3 text-sm text-white/70">
              No bots are switched on yet.{" "}
              <Link href="/ai/control-room/bots" className="font-semibold text-fp-pink-light underline">
                Connect one
              </Link>
              .
            </p>
          ) : (
            <form action={startRun} className="mt-4 grid gap-4">
              <fieldset>
                <legend className="sr-only">Which bot</legend>
                <div className="flex flex-wrap gap-2">
                  {askable.map((b) => (
                    <label key={b.id} className="cursor-pointer">
                      <input type="radio" name="bot_id" value={b.id} defaultChecked={b.id === chosen?.id} className="peer sr-only" />
                      <span className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 py-1.5 pl-1.5 pr-3 text-sm text-white/70 transition peer-checked:border-fp-pink peer-checked:bg-fp-pink/15 peer-checked:text-white peer-checked:shadow-[0_0_18px_rgba(222,34,119,0.45)] peer-focus-visible:ring-2 peer-focus-visible:ring-fp-pink-light hover:bg-white/10">
                        <BotAvatar name={b.name} engine={b.engine} size="sm" />
                        <span className="font-semibold">{b.name}</span>
                        <StatusLight status={ready(b) ? "ready" : "waiting"} />
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <textarea
                  name="request"
                  rows={3}
                  required
                  maxLength={4000}
                  aria-label="What would you like it to do?"
                  placeholder="e.g. Quote Riverside Bakery for 1,000 A5 leaflets, double-sided, same as last time."
                  className="min-h-24 flex-1 resize-y rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-fp-pink focus:outline-none focus:ring-2 focus:ring-fp-pink/40"
                />
                <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-fp-pink px-5 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(222,34,119,0.55)] transition hover:bg-fp-pink/90">
                  <Send size={16} aria-hidden /> Send it
                </button>
              </div>
              <p className="text-xs text-white/45">Bots only make drafts. Nothing goes to a customer until you&apos;ve checked it and sent it yourself.</p>
              {notReady.length > 0 && (
                <p className="rounded-lg border border-fp-amber/40 bg-fp-amber/10 px-3 py-2 text-xs text-fp-amber">
                  Not connected yet (an admin needs to add the key in Netlify): {notReady.map((b) => `${b.name} (${botKeyName(b)})`).join(", ")}.
                </p>
              )}
            </form>
          )}
        </div>
      </section>

      {/* Numbers */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-fp-border bg-white p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-fp-mid">
                <Icon size={13} aria-hidden className="text-fp-pink" /> {s.label}
              </p>
              <p className="mt-1 font-mono text-2xl font-black">{s.value}</p>
            </div>
          );
        })}
      </section>

      {/* The team */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider">The team</h3>
          <Link href="/ai/control-room/bots" className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline">
            Connect or manage bots <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {all.map((b) => {
            const state = !b.active ? "off" : ready(b) ? "ready" : "waiting";
            return (
              <li key={b.id}>
                <Link
                  href={`/ai/control-room/bots/${b.id}`}
                  className="group flex h-full gap-3 rounded-xl border border-fp-border bg-white p-4 transition hover:-translate-y-0.5 hover:border-fp-pink/40 hover:shadow-lg"
                >
                  <BotAvatar name={b.name} engine={b.engine} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-bold group-hover:text-fp-pink">{b.name}</span>
                      <StatusLight status={state} />
                    </span>
                    {b.description && <span className="mt-0.5 line-clamp-2 block text-xs text-fp-dark/80">{b.description}</span>}
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      <span className="rounded-md bg-fp-light px-1.5 py-0.5 font-mono text-[10px]">{engineLabel[b.engine as BotEngine]}</span>
                      {(b.skills.length ? b.skills : ["talks"]).map((s: string) => (
                        <span key={s} className="rounded-md bg-fp-pink/10 px-1.5 py-0.5 font-mono text-[10px] text-fp-pink">
                          {s}
                        </span>
                      ))}
                    </span>
                    <span className="mt-1 block text-[11px] text-fp-mid">
                      {b.owner_id ? (nameOf.get(b.owner_id) ?? "—") : "Footprint"} · {state === "ready" ? "Ready" : state === "off" ? "Switched off" : b.engine === "outside" ? "Calls in only" : "Needs its key"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Activity */}
      <section>
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider">Activity</h3>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-fp-border bg-white p-6 text-center text-sm text-fp-mid">No runs yet. Give a bot its first job above.</p>
        ) : (
          <ol className="overflow-hidden rounded-xl border border-fp-border bg-white">
            {recent.map((r, i) => {
              const bot = r.ai_bots as unknown as { name: string; engine: string } | null;
              return (
                <li key={r.id} className={i ? "border-t border-fp-border" : ""}>
                  <Link href={`/ai/control-room/runs/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-fp-offwhite">
                    <BotAvatar name={bot?.name ?? "Bot"} engine={bot?.engine ?? "outside"} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.request}</span>
                      <span className="block truncate text-xs text-fp-mid">
                        {bot?.name ?? "Bot"} · {r.source === "outside" ? "outside bot" : (nameOf.get(r.requested_by ?? "") ?? "—")} · {shortDateTime(r.created_at)}
                      </span>
                    </span>
                    {r.draft_ids.length > 0 && (
                      <span className="hidden rounded-md bg-fp-teal/15 px-2 py-0.5 text-xs font-semibold text-fp-teal-deep sm:inline">
                        {r.draft_ids.length === 1 ? "1 draft" : `${r.draft_ids.length} drafts`}
                      </span>
                    )}
                    <RunStatus status={r.status} />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </Pane>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Hash, LayoutGrid, Plus, Settings2, Terminal } from "lucide-react";
import { BotAvatar, StatusLight } from "./parts";

export type RailBot = { id: string; name: string; engine: string; description: string | null; state: "ready" | "waiting" | "off" };

const stateLabel = { ready: "Ready", waiting: "Needs its key", off: "Switched off" };

// The control room's side panel (like Team chat's chat list, in the dark).
// On a phone it shows on the control room's front page only.
export default function ControlRail({
  bots,
  chats,
  runs,
}: {
  bots: RailBot[];
  chats: { id: string; title: string }[];
  runs: { id: string; request: string; status: string; bot: string }[];
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const home = pathname === "/ai/control-room";
  const picked = home ? params.get("bot") : null;
  const ready = bots.filter((b) => b.state === "ready").length;

  const row = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
      active ? "bg-white/10 text-white ring-1 ring-white/15" : "text-white/70 hover:bg-white/5 hover:text-white"
    }`;
  const heading = "px-2 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40";

  return (
    <aside className={`${home ? "flex" : "hidden"} min-h-0 shrink-0 flex-col border-white/10 text-white lg:flex lg:w-72 lg:border-r`}>
      <div className="bg-fp-gradient h-1" />
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <Link href="/ai/control-room" className="group">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-fp-pink-light">
            <Terminal size={14} aria-hidden /> Control room
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-white/60">
            <StatusLight status={ready ? "ready" : "off"} />
            {ready} of {bots.length} bot{bots.length === 1 ? "" : "s"} online
          </p>
        </Link>
        <Link
          href="/ai/control-room/chats/new"
          aria-label="New group chat"
          title="New group chat"
          className="rounded-lg bg-fp-pink p-2 text-white shadow-[0_0_16px_rgba(222,34,119,0.5)] hover:bg-fp-pink/90"
        >
          <Plus size={16} aria-hidden />
        </Link>
      </div>

      <nav aria-label="Control room" className="flex-1 overflow-y-auto px-2 pb-3">
        <Link href="/ai/control-room" aria-current={home && !picked ? "page" : undefined} className={row(home && !picked)}>
          <LayoutGrid size={16} aria-hidden className="text-white/50" />
          Overview
        </Link>

        <p className={heading}>Bots</p>
        <ul className="grid gap-0.5">
          {bots.map((b) => (
            <li key={b.id}>
              <Link
                href={`/ai/control-room?bot=${b.id}`}
                aria-current={picked === b.id ? "page" : undefined}
                title={`${b.name}: ${stateLabel[b.state]}${b.description ? ` · ${b.description}` : ""}`}
                className={row(picked === b.id)}
              >
                <span className="relative">
                  <BotAvatar name={b.name} engine={b.engine} size="sm" />
                  <StatusLight status={b.state} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-fp-black" />
                </span>
                <span className={`min-w-0 flex-1 truncate ${b.state === "off" ? "text-white/40" : ""}`}>{b.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/ai/control-room/bots" className={`${row(pathname.startsWith("/ai/control-room/bots"))} mt-1 text-xs`}>
          <Settings2 size={14} aria-hidden className="text-white/50" />
          Connect or manage bots
        </Link>

        <p className={heading}>Group chats</p>
        {chats.length === 0 ? (
          <p className="px-2 text-xs text-white/40">None yet. Press + to start one.</p>
        ) : (
          <ul className="grid gap-0.5">
            {chats.map((c) => {
              const active = pathname === `/ai/control-room/chats/${c.id}`;
              return (
                <li key={c.id}>
                  <Link href={`/ai/control-room/chats/${c.id}`} aria-current={active ? "page" : undefined} className={row(active)}>
                    <Hash size={14} aria-hidden className={active ? "text-fp-pink-light" : "text-white/40"} />
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className={heading}>Recent runs</p>
        {runs.length === 0 ? (
          <p className="px-2 text-xs text-white/40">Nothing asked yet.</p>
        ) : (
          <ul className="grid gap-0.5">
            {runs.map((r) => {
              const active = pathname === `/ai/control-room/runs/${r.id}`;
              return (
                <li key={r.id}>
                  <Link href={`/ai/control-room/runs/${r.id}`} aria-current={active ? "page" : undefined} className={row(active)} title={r.request}>
                    <StatusLight status={r.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">{r.request}</span>
                      <span className="block truncate font-mono text-[10px] text-white/40">{r.bot}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}

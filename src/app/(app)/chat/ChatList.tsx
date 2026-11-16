"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Hash, Lock, Plus, Search, UserRound } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { tidyChatFiles } from "./actions";

type Chat = {
  id: string;
  kind: "channel" | "direct";
  name: string | null;
  private: boolean;
  archived: boolean;
  joined: boolean;
  unread: number;
  mentions: number;
  people: string | null;
};

// The chats down the side, with unread counts. Keeps itself up to date: when
// a message arrives anywhere this person can see, the list is refreshed.
export default function ChatList({ chats, userId }: { chats: Chat[]; userId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void tidyChatFiles().catch(() => undefined);
    const supabase = createBrowserSupabase();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (stopped || !data.session) return;
      supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel("team-chat-list")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "team_chat_messages" }, (payload) => {
          if ((payload.new as { author_id?: string }).author_id === userId) return;
          // Several messages at once: refresh once.
          if (pending.current) clearTimeout(pending.current);
          pending.current = setTimeout(() => router.refresh(), 800);
        })
        .subscribe();
    })();
    return () => {
      stopped = true;
      if (pending.current) clearTimeout(pending.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  const current = pathname.split("/")[2] ?? "";
  const joined = chats.filter((c) => c.joined && c.kind === "channel" && !c.archived);
  const direct = chats.filter((c) => c.joined && c.kind === "direct");
  const others = chats.filter((c) => !c.joined && c.kind === "channel");
  const totalUnread = chats.reduce((s, c) => s + (c.joined ? c.unread : 0), 0);

  // Show the unread count in the browser tab too.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = totalUnread ? `(${totalUnread}) ${base}` : base;
  }, [totalUnread, pathname]);

  const item = (c: Chat) => {
    const Icon = c.kind === "direct" ? UserRound : c.private ? Lock : Hash;
    const active = current === c.id;
    const label = c.kind === "direct" ? c.people || "Just you" : c.name;
    return (
      <li key={c.id}>
        <Link
          href={`/chat/${c.id}`}
          aria-current={active ? "page" : undefined}
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${active ? "bg-fp-black text-white" : "hover:bg-fp-light"} ${
            c.unread && !active ? "font-bold" : ""
          }`}
        >
          <Icon size={14} aria-hidden className={active ? "text-fp-pink-light" : "text-fp-mid"} />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {c.mentions > 0 && !active ? (
            <span className="rounded-full bg-fp-pink px-1.5 text-xs font-bold text-white" title={`${c.mentions} mention${c.mentions === 1 ? "" : "s"}`}>
              @{c.mentions}
            </span>
          ) : c.unread > 0 && !active ? (
            <span className="rounded-full bg-fp-black px-1.5 text-xs font-bold text-white">{c.unread}</span>
          ) : null}
        </Link>
      </li>
    );
  };

  // On a phone the list is its own screen (/chat); inside a chat it's hidden.
  const onList = pathname === "/chat" || pathname === "/chat/";
  return (
    <aside className={`${onList ? "flex w-full" : "hidden"} min-h-0 shrink-0 flex-col border-r border-fp-border bg-white lg:flex lg:w-64`}>
      <div className="flex items-center justify-between gap-2 border-b border-fp-border px-3 py-3">
        <h1 className="font-black">Team chat</h1>
        <div className="flex gap-1">
          <Link href="/chat/search" aria-label="Search messages" className="rounded-md p-1.5 hover:bg-fp-light">
            <Search size={16} aria-hidden />
          </Link>
          <Link href="/chat/new" aria-label="New channel or message" className="rounded-md bg-fp-pink p-1.5 text-white hover:bg-fp-pink/90">
            <Plus size={16} aria-hidden />
          </Link>
        </div>
      </div>
      <nav aria-label="Chats" className="flex-1 overflow-y-auto px-2 py-3 text-sm">
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-fp-mid">Channels</p>
        <ul className="grid gap-0.5">{joined.map(item)}</ul>
        <p className="mt-4 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-fp-mid">Direct messages</p>
        {direct.length ? (
          <ul className="grid gap-0.5">{direct.map(item)}</ul>
        ) : (
          <p className="px-2 text-xs text-fp-mid">
            <Link href="/chat/new" className="font-semibold text-fp-teal-deep hover:underline">
              Message someone
            </Link>
          </p>
        )}
        {others.length > 0 && (
          <>
            <p className="mt-4 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-fp-mid">Other channels to join</p>
            <ul className="grid gap-0.5 text-fp-dark/80">{others.map(item)}</ul>
          </>
        )}
      </nav>
    </aside>
  );
}

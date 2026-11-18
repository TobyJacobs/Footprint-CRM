"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Incoming = { id: string; channel_id: string; author_id: string | null; body: string; attachments: unknown[]; mentions: string[] };
type ChatInfo = { kind: "channel" | "direct"; name: string | null };

// Team chat alerts on every FootprintOS page. While at least one tab is open,
// a new message in any chat this person is in (or one that @mentions them)
// pops up a desktop alert if they've allowed alerts, unless they're already
// looking at that chat. Also tells the menu to add one to its unread count.
export default function ChatAlerts({ userId, onUnread }: { userId: string; onUnread: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathRef = useRef(pathname);
  const onUnreadRef = useRef(onUnread);
  // The chats this person is in, and names of people already looked up.
  const chats = useRef(new Map<string, ChatInfo>());
  const names = useRef(new Map<string, string>());

  useEffect(() => {
    pathRef.current = pathname;
    onUnreadRef.current = onUnread;
  }, [pathname, onUnread]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;

    const loadChats = async () => {
      const { data } = await supabase
        .from("team_chat_members")
        .select("channel_id, team_chat_channels(kind, name)")
        .eq("user_id", userId);
      const next = new Map<string, ChatInfo>();
      for (const row of data ?? []) {
        const c = row.team_chat_channels as unknown as ChatInfo | null;
        if (c) next.set(row.channel_id as string, c);
      }
      chats.current = next;
    };

    const nameOf = async (id: string | null) => {
      if (!id) return "Someone";
      const known = names.current.get(id);
      if (known) return known;
      const { data } = await supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle();
      const name = data ? (data.full_name ?? data.email) : "Someone";
      names.current.set(id, name);
      return name;
    };

    const arrived = async (m: Incoming) => {
      if (m.author_id === userId) return;
      // A chat started since this page loaded (e.g. someone messaged them).
      if (!chats.current.has(m.channel_id)) await loadChats();
      const chat = chats.current.get(m.channel_id);
      const mentioned = m.mentions?.includes(userId);
      if (!chat && !mentioned) return;
      const looking = pathRef.current === `/chat/${m.channel_id}` && document.visibilityState === "visible";
      if (looking) return;
      // The chat list on /chat pages keeps its own counts; elsewhere bump the menu.
      if (chat && !pathRef.current.startsWith("/chat")) onUnreadRef.current();
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const who = await nameOf(m.author_id);
      const where = chat?.kind === "channel" && chat.name ? ` in #${chat.name}` : "";
      const alert = new Notification(mentioned ? `${who} mentioned you${where}` : `${who}${where}`, {
        body: m.body.slice(0, 160) || "Sent a file",
        tag: m.channel_id,
      });
      alert.onclick = () => {
        window.focus();
        router.push(`/chat/${m.channel_id}`);
        alert.close();
      };
    };

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (stopped || !data.session) return;
      supabase.realtime.setAuth(data.session.access_token);
      await loadChats();
      if (stopped) return;
      channel = supabase
        .channel("team-chat-alerts")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "team_chat_messages" }, (p) => void arrived(p.new as Incoming))
        .subscribe();
    })();

    // Pick up chats joined or left on other pages now and then.
    const refresh = setInterval(() => void loadChats(), 5 * 60 * 1000);
    return () => {
      stopped = true;
      clearInterval(refresh);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}

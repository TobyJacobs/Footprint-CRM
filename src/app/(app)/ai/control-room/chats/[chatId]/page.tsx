import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { shortDateTime } from "@/lib/customers/display";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { postChatMessage } from "../../actions";
import { BotAvatar, PaneHeader, PersonAvatar } from "../../parts";
import ChatDriver from "./ChatDriver";
import ScrollToEnd from "./ScrollToEnd";

export const metadata: Metadata = { title: "Group chat · Control room" };

// A group chat, laid out like a Team chat room: the bots take turns to reply
// and people can join in.
export default async function ChatPage(props: PageProps<"/ai/control-room/chats/[chatId]">) {
  await requirePermission("ai", "view");
  const { chatId } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(chatId)) notFound();
  const supabase = await createClient();
  const [{ data: chat }, { data: members }, { data: messages }, { nameOf }] = await Promise.all([
    supabase.from("ai_chats").select("id, title, created_by, created_at").eq("id", chatId).maybeSingle(),
    supabase.from("ai_chat_bots").select("position, ai_bots(id, name, engine, active)").eq("chat_id", chatId).order("position"),
    supabase.from("ai_chat_messages").select("id, author_id, bot_id, body, created_at").eq("chat_id", chatId).order("created_at").limit(500),
    loadPeople(supabase),
  ]);
  if (!chat) notFound();
  const bots = (members ?? []).map((m) => m.ai_bots as unknown as { id: string; name: string; engine: string; active: boolean }).filter(Boolean);
  const botById = new Map(bots.map((b) => [b.id, b]));
  const error = typeof sp.error === "string" ? sp.error : null;
  const list = messages ?? [];

  return (
    <>
      <PaneHeader
        title={
          <span className="flex items-center gap-2">
            <Link href="/ai/control-room" aria-label="Back to the control room" className="rounded-md p-1 hover:bg-fp-light lg:hidden">
              <ArrowLeft size={18} aria-hidden />
            </Link>
            <span className="text-fp-pink">#</span> {chat.title}
          </span>
        }
        sub={`Started by ${nameOf.get(chat.created_by ?? "") ?? "—"} · ${shortDateTime(chat.created_at)} · bots only talk here: they don't make quotes or send anything`}
      >
        <div className="flex -space-x-1.5">
          {bots.map((b) => (
            <span key={b.id} title={b.name} className="rounded-lg ring-2 ring-white">
              <BotAvatar name={b.name} engine={b.engine} size="sm" />
            </span>
          ))}
        </div>
      </PaneHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <ol className="grid gap-1">
          {list.map((m, i) => {
            const bot = m.bot_id ? botById.get(m.bot_id) : null;
            const name = m.bot_id ? (bot?.name ?? "A bot") : (nameOf.get(m.author_id ?? "") ?? "Someone");
            const prev = list[i - 1];
            const grouped = prev && prev.bot_id === m.bot_id && prev.author_id === m.author_id;
            return (
              <li key={m.id} className={`flex gap-3 rounded-lg px-2 ${grouped ? "py-0.5" : "mt-3 py-1"} hover:bg-white`}>
                <span className="w-9 shrink-0">
                  {!grouped && (m.bot_id ? <BotAvatar name={name} engine={bot?.engine ?? "outside"} /> : <PersonAvatar name={name} />)}
                </span>
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <p className="text-sm">
                      <span className="font-bold">{name}</span>
                      {m.bot_id && <span className="ml-1.5 rounded bg-fp-black px-1 py-px font-mono text-[9px] font-bold uppercase tracking-wider text-white">bot</span>}{" "}
                      <span className="text-xs text-fp-mid">{shortDateTime(m.created_at)}</span>
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <ScrollToEnd count={list.length} />
      </div>

      <div className="border-t border-fp-border bg-white px-3 py-3 sm:px-6">
        <ChatDriver chatId={chat.id} bots={bots.filter((b) => b.active).map(({ id, name }) => ({ id, name }))} startNow={sp.talk === "1"} />
        {error && (
          <p role="alert" className="mt-2 text-xs text-fp-error">
            {error}
          </p>
        )}
        <form action={postChatMessage.bind(null, chat.id)} className="mt-2 flex items-end gap-2">
          <textarea
            name="body"
            rows={1}
            required
            maxLength={8000}
            aria-label="Your message"
            placeholder="Join in…"
            className="min-h-10 flex-1 resize-y rounded-md border border-fp-border px-3 py-2 text-sm focus:border-fp-pink focus:outline-none focus:ring-2 focus:ring-fp-pink/20"
          />
          <button aria-label="Post" className="rounded-md bg-fp-pink p-2.5 text-white hover:bg-fp-pink/90">
            <Send size={16} aria-hidden />
          </button>
        </form>
        <p className="mt-1 text-[11px] text-fp-mid">After posting, press Let them talk (or one bot&apos;s name) for the bots to reply.</p>
      </div>
    </>
  );
}

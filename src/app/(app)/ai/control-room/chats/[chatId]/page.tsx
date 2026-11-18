import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, inputClass, primaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { shortDateTime } from "@/lib/customers/display";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { postChatMessage } from "../../actions";
import ChatDriver from "./ChatDriver";

export const metadata: Metadata = { title: "Group chat · Control room" };

// A group chat: the bots take turns to reply and people can join in.
export default async function ChatPage(props: PageProps<"/ai/control-room/chats/[chatId]">) {
  await requirePermission("ai", "view");
  const { chatId } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(chatId)) notFound();
  const supabase = await createClient();
  const [{ data: chat }, { data: members }, { data: messages }, { nameOf }] = await Promise.all([
    supabase.from("ai_chats").select("id, title, created_by, created_at").eq("id", chatId).maybeSingle(),
    supabase.from("ai_chat_bots").select("position, ai_bots(id, name, active)").eq("chat_id", chatId).order("position"),
    supabase.from("ai_chat_messages").select("id, author_id, bot_id, body, created_at").eq("chat_id", chatId).order("created_at").limit(500),
    loadPeople(supabase),
  ]);
  if (!chat) notFound();
  const bots = (members ?? []).map((m) => m.ai_bots as unknown as { id: string; name: string; active: boolean }).filter(Boolean);
  const botName = new Map(bots.map((b) => [b.id, b.name]));
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/ai/control-room" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Control room
      </Link>
      <div>
        <h2 className="text-2xl font-black">{chat.title}</h2>
        <p className="text-sm text-fp-mid">
          With {bots.map((b) => b.name).join(", ")} · started by {nameOf.get(chat.created_by ?? "") ?? "—"} · {shortDateTime(chat.created_at)}
        </p>
      </div>

      <Card>
        <ol className="grid gap-4">
          {(messages ?? []).map((m) => (
            <li key={m.id} className={`grid gap-1 rounded-md p-3 ${m.bot_id ? "bg-fp-offwhite" : "border border-fp-border"}`}>
              <p className="text-xs font-bold">
                {m.bot_id ? `🤖 ${botName.get(m.bot_id) ?? "A bot"}` : (nameOf.get(m.author_id ?? "") ?? "Someone")}
                <span className="ml-2 font-normal text-fp-mid">{shortDateTime(m.created_at)}</span>
              </p>
              <p className="whitespace-pre-wrap text-sm">{m.body}</p>
            </li>
          ))}
        </ol>
      </Card>

      <ChatDriver chatId={chat.id} bots={bots.filter((b) => b.active).map(({ id, name }) => ({ id, name }))} startNow={sp.talk === "1"} />

      <Card title="Join in">
        {error && <p className="mb-3 text-sm text-fp-error">{error}</p>}
        <form action={postChatMessage.bind(null, chat.id)} className="grid gap-3">
          <textarea name="body" rows={3} required maxLength={8000} className={inputClass} aria-label="Your message" />
          <div>
            <button className={primaryButton}>Post</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-fp-mid">After posting, press Let them talk (or one bot&apos;s name) for the bots to reply.</p>
      </Card>
    </div>
  );
}

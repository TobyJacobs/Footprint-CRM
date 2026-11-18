import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage, ChatPerson } from "@/lib/team-chat-types";

// Team chat (staff only; see the team_chat migration). The database decides
// what each person can see: open channels for all staff, private channels and
// direct messages only for the people in them.

export type ChatSummary = {
  id: string;
  kind: "channel" | "direct";
  name: string | null;
  topic: string | null;
  private: boolean;
  archived: boolean;
  last_message_at: string | null;
  joined: boolean;
  unread: number;
  mentions: number;
  people: string | null;
};

export const chatTitle = (c: Pick<ChatSummary, "kind" | "name" | "people">) => (c.kind === "direct" ? c.people || "Just you" : c.name ?? "");

export async function getChatOverview(): Promise<ChatSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("team_chat_overview");
  return ((data ?? []) as ChatSummary[]).map((c) => ({ ...c, unread: Number(c.unread), mentions: Number(c.mentions) }));
}

export async function getChatUnread(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("team_chat_unread");
  return typeof data === "number" ? data : 0;
}

// Everyone who can be messaged or mentioned (active staff).
export async function getChatPeople(): Promise<ChatPerson[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name");
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email }));
}

export const MESSAGE_FIELDS = "id, channel_id, author_id, body, attachments, mentions, created_at, edited_at";

// The latest messages in a chat, oldest first.
export async function getLatestMessages(channelId: string, limit = 60): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_chat_messages")
    .select(MESSAGE_FIELDS)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as ChatMessage[]).reverse();
}

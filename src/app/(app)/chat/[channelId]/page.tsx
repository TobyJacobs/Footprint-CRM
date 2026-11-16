import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Hash, Lock, Settings, UserRound } from "lucide-react";
import { Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getChatOverview, getChatPeople, getLatestMessages, chatTitle } from "@/lib/team-chat";
import { addPeople, joinChannel, leaveChannel, saveChannel } from "../actions";
import ChatRoom from "./ChatRoom";

export const metadata: Metadata = { title: "Chat" };

// One chat: its messages (live), and its settings (people, name, topic).
export default async function ChatPage(props: PageProps<"/chat/[channelId]">) {
  const user = await getCurrentUser();
  const { channelId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(channelId)) notFound();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: channel }, { data: memberRows }, people, overview, messages] = await Promise.all([
    supabase.from("team_chat_channels").select("id, kind, name, topic, private, archived, created_by").eq("id", channelId).maybeSingle(),
    supabase.from("team_chat_members").select("user_id, last_read_at").eq("channel_id", channelId),
    getChatPeople(),
    getChatOverview(),
    getLatestMessages(channelId),
  ]);
  if (!channel) notFound();
  const summary = overview.find((c) => c.id === channelId);
  const members = (memberRows ?? []).map((m) => m.user_id as string);
  const joined = members.includes(user.id);
  const title = summary ? chatTitle(summary) : channel.name ?? "Chat";
  const canChange = channel.kind === "channel" && (channel.created_by === user.id || user.isAdmin);
  const settings = sp.settings === "1";
  const Icon = channel.kind === "direct" ? UserRound : channel.private ? Lock : Hash;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Former member of staff";
  const notIn = people.filter((p) => !members.includes(p.id));
  const myReadAt = (memberRows ?? []).find((m) => m.user_id === user.id)?.last_read_at ?? null;

  return (
    <>
      <header className="flex items-center gap-2 border-b border-fp-border bg-white px-3 py-2.5 sm:px-4">
        <Link href="/chat" aria-label="All chats" className="rounded-md p-1 hover:bg-fp-light lg:hidden">
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <Icon size={16} aria-hidden className="shrink-0 text-fp-mid" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold">{title}</h2>
          {channel.topic && <p className="truncate text-xs text-fp-mid">{channel.topic}</p>}
        </div>
        <span className="hidden text-xs text-fp-mid sm:inline">
          {members.length} {members.length === 1 ? "person" : "people"}
        </span>
        <Link
          href={settings ? `/chat/${channelId}` : `/chat/${channelId}?settings=1`}
          aria-label="People and settings"
          aria-expanded={settings}
          className={`rounded-md p-1.5 ${settings ? "bg-fp-light" : "hover:bg-fp-light"}`}
        >
          <Settings size={16} aria-hidden />
        </Link>
      </header>

      {settings && (
        <section className="max-h-[50vh] overflow-y-auto border-b border-fp-border bg-fp-offwhite px-4 py-4 text-sm">
          <Notice searchParams={sp} />
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-2 font-semibold">People ({members.length})</p>
              <ul className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <li key={m} className="rounded-full bg-white px-2.5 py-1 text-xs ring-1 ring-fp-border">
                    {nameOf(m)}
                    {m === user.id ? " (you)" : ""}
                  </li>
                ))}
              </ul>
              {channel.kind === "channel" && (joined || !channel.private) && notIn.length > 0 && (
                <form action={addPeople.bind(null, channelId)} className="mt-3 grid gap-2">
                  <details>
                    <summary className="cursor-pointer font-semibold text-fp-teal-deep">Add people</summary>
                    <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
                      {notIn.map((p) => (
                        <label key={p.id} className="flex items-center gap-2">
                          <input type="checkbox" name="people" value={p.id} className="accent-fp-pink" /> {p.name}
                        </label>
                      ))}
                    </div>
                    <button type="submit" className={`${secondaryButton} mt-2`}>
                      Add
                    </button>
                  </details>
                </form>
              )}
              {channel.kind === "direct" && (
                <p className="mt-3 text-xs text-fp-mid">
                  Only these people can read this conversation. To include someone else, start a new message with everyone in it.
                </p>
              )}
              {channel.kind === "channel" && channel.private && (
                <p className="mt-3 text-xs text-fp-mid">Private channel: only the people in it can read it, and any of them can add others.</p>
              )}
              {channel.kind === "channel" && joined && (
                <form action={leaveChannel.bind(null, channelId)} className="mt-3">
                  <button type="submit" className="text-xs font-semibold text-fp-error hover:underline">
                    Leave this channel
                  </button>
                </form>
              )}
            </div>
            {canChange && (
              <form action={saveChannel.bind(null, channelId)} className="grid content-start gap-2">
                <p className="font-semibold">Channel details</p>
                <input name="name" required maxLength={60} defaultValue={channel.name ?? ""} aria-label="Name" className={inputClass} />
                <input name="topic" maxLength={300} defaultValue={channel.topic ?? ""} placeholder="What it's for (optional)" aria-label="Topic" className={inputClass} />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="archived" defaultChecked={channel.archived} className="accent-fp-pink" />
                  Archived (read only; hidden from the list for people not in it)
                </label>
                <div>
                  <button type="submit" className={secondaryButton}>
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}

      {!joined && channel.kind === "channel" && !channel.archived && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fp-border bg-fp-teal/10 px-4 py-2 text-sm">
          <span>You&apos;re not in this channel. Join it to see it in your list and get unread counts.</span>
          <form action={joinChannel.bind(null, channelId)}>
            <button type="submit" className={primaryButton}>
              Join
            </button>
          </form>
        </div>
      )}

      <ChatRoom
        key={channelId}
        channelId={channelId}
        userId={user.id}
        people={people}
        memberIds={channel.kind === "channel" && !channel.private ? people.map((p) => p.id) : members}
        initial={messages}
        firstUnreadAfter={joined ? myReadAt : null}
        readOnly={channel.archived}
        placeholder={channel.kind === "direct" ? `Message ${title}` : `Message #${channel.name}`}
      />
    </>
  );
}

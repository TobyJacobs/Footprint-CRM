"use client";

import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, FileText, Paperclip, Pencil, SendHorizontal, Trash2, X } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { MAX_FILE_BYTES, MAX_MESSAGE_LENGTH, type ChatAttachment, type ChatMessage, type ChatPerson } from "@/lib/team-chat-types";

const FIELDS = "id, channel_id, author_id, body, attachments, mentions, created_at, edited_at";
const PAGE = 60;

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const key = (x: Date) => x.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (key(d) === key(today)) return "Today";
  if (key(d) === key(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
};
const sizeLabel = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Links and @mentions in a message, the rest as plain text (never as HTML).
function Body({ text, mentionNames, mine }: { text: string; mentionNames: string[]; mine: string | null }) {
  const names = mentionNames.filter(Boolean).sort((a, b) => b.length - a.length);
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(https?://[^\\s<]+)${escaped.length ? `|@(${escaped.join("|")})` : ""}`, "g");
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) {
      parts.push(
        <a key={m.index} href={m[1]} target="_blank" rel="noopener noreferrer" className="break-all text-fp-teal-deep underline">
          {m[1]}
        </a>,
      );
    } else {
      parts.push(
        <span key={m.index} className={`rounded px-0.5 font-semibold ${m[2] === mine ? "bg-fp-pink/20 text-fp-pink" : "bg-fp-teal/15 text-fp-teal-deep"}`}>
          @{m[2]}
        </span>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p className="whitespace-pre-wrap break-words">{parts}</p>;
}

export default function ChatRoom({
  channelId,
  userId,
  people,
  memberIds,
  initial,
  firstUnreadAfter,
  readOnly,
  placeholder,
}: {
  channelId: string;
  userId: string;
  people: ChatPerson[];
  memberIds: string[];
  initial: ChatMessage[];
  firstUnreadAfter: string | null;
  readOnly: boolean;
  placeholder: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [hasOlder, setHasOlder] = useState(initial.length >= PAGE);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<(ChatAttachment & { uploading?: boolean })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [alerts, setAlerts] = useState<NotificationPermission | "unsupported">("unsupported");
  const listRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nearBottom = useRef(true);
  // The latest list of people, for alerts from the live connection (which
  // stays connected while the page refreshes around it).
  const peopleRef = useRef(people);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  const nameOf = useCallback((id: string | null) => people.find((p) => p.id === id)?.name ?? "Former member of staff", [people]);
  const myName = people.find((p) => p.id === userId)?.name ?? null;

  // Mark this chat read (and refresh the unread counts in the list).
  const markRead = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    await supabase.from("team_chat_members").update({ last_read_at: new Date().toISOString() }).eq("channel_id", channelId).eq("user_id", userId);
    router.refresh();
  }, [supabase, channelId, userId, router]);

  // Live: new, changed and deleted messages in this chat.
  useEffect(() => {
    // Whether desktop alerts are on (only known in the browser, after the first render).
    const alertCheck = setTimeout(() => setAlerts(typeof Notification === "undefined" ? "unsupported" : Notification.permission), 0);
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    void markRead();
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (stopped || !data.session) return;
      supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`team-chat-${channelId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "team_chat_messages", filter: `channel_id=eq.${channelId}` }, (p) => {
          const m = p.new as ChatMessage;
          setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
          if (m.author_id !== userId) {
            void markRead();
            if (document.visibilityState !== "visible" && typeof Notification !== "undefined" && Notification.permission === "granted") {
              const who = peopleRef.current.find((x) => x.id === m.author_id)?.name ?? "Someone";
              new Notification(`${who} · Team chat`, { body: m.body.slice(0, 140) || "Sent a file", tag: channelId });
            }
          }
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "team_chat_messages", filter: `channel_id=eq.${channelId}` }, (p) => {
          const m = p.new as ChatMessage;
          setMessages((list) => list.map((x) => (x.id === m.id ? m : x)));
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "team_chat_messages" }, (p) => {
          const id = (p.old as { id?: string }).id;
          if (id) setMessages((list) => list.filter((x) => x.id !== id));
        })
        .subscribe();
    })();
    const onVisible = () => void markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(alertCheck);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, channelId, userId, markRead]);

  // Stay at the bottom as messages arrive, unless reading further up.
  useEffect(() => {
    const el = listRef.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Files are private: get short-lived links for the ones on screen.
  useEffect(() => {
    const missing = [...new Set(messages.flatMap((m) => m.attachments.map((a) => a.path)))].filter((p) => !urls[p]);
    if (!missing.length) return;
    void supabase.storage
      .from("team-chat")
      .createSignedUrls(missing, 60 * 60)
      .then(({ data }) => {
        const add: Record<string, string> = {};
        for (const d of data ?? []) if (d.path && d.signedUrl) add[d.path] = d.signedUrl;
        setUrls((u) => ({ ...u, ...add }));
      });
  }, [messages, supabase, urls]);

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!oldest) return;
    const el = listRef.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    const { data } = await supabase
      .from("team_chat_messages")
      .select(FIELDS)
      .eq("channel_id", channelId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    const older = ((data ?? []) as ChatMessage[]).reverse();
    setHasOlder(older.length >= PAGE);
    nearBottom.current = false;
    setMessages((list) => [...older, ...list]);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    });
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    const chosen = [...list].slice(0, 10 - files.length);
    for (const f of chosen) {
      if (f.size > MAX_FILE_BYTES) {
        setError(`"${f.name}" is bigger than 20 MB.`);
        continue;
      }
      const path = `${channelId}/${crypto.randomUUID()}`;
      const entry = { path, name: f.name.slice(0, 200), size: f.size, type: f.type || "application/octet-stream", uploading: true };
      setFiles((fs) => [...fs, entry]);
      const { error: upError } = await supabase.storage.from("team-chat").upload(path, f, { contentType: entry.type });
      if (upError) {
        setError(`"${f.name}" couldn't be uploaded: ${upError.message}`);
        setFiles((fs) => fs.filter((x) => x.path !== path));
      } else {
        setFiles((fs) => fs.map((x) => (x.path === path ? { ...x, uploading: false } : x)));
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = async (path: string) => {
    setFiles((fs) => fs.filter((x) => x.path !== path));
    // Not sent yet, so nobody else has it: tidy it away.
    await supabase.storage.from("team-chat").remove([path]).catch(() => undefined);
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !files.length) || sending || files.some((f) => f.uploading)) return;
    if (body.length > MAX_MESSAGE_LENGTH) return setError(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters.`);
    setSending(true);
    setError(null);
    const mentions = people.filter((p) => p.id !== userId && body.includes(`@${p.name}`)).map((p) => p.id);
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      channel_id: channelId,
      author_id: userId,
      body,
      attachments: files.map(({ path, name, size, type }) => ({ path, name, size, type })),
      mentions,
      created_at: new Date().toISOString(),
      edited_at: null,
    };
    const { error: sendError } = await supabase.from("team_chat_messages").insert({
      id: message.id,
      channel_id: channelId,
      author_id: userId,
      body,
      attachments: message.attachments,
      mentions,
    });
    setSending(false);
    if (sendError) return setError(`Not sent: ${sendError.message}`);
    nearBottom.current = true;
    setMessages((list) => (list.some((x) => x.id === message.id) ? list : [...list, message]));
    setText("");
    setFiles([]);
    setMention(null);
    router.refresh();
    boxRef.current?.focus();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const body = editing.body.trim();
    const original = messages.find((m) => m.id === editing.id);
    if (!body && !original?.attachments.length) return;
    const { error: editError } = await supabase.from("team_chat_messages").update({ body }).eq("id", editing.id);
    if (editError) return setError(`Not saved: ${editError.message}`);
    setMessages((list) => list.map((m) => (m.id === editing.id ? { ...m, body, edited_at: new Date().toISOString() } : m)));
    setEditing(null);
  };

  const remove = async (m: ChatMessage) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    const { error: delError } = await supabase.from("team_chat_messages").delete().eq("id", m.id);
    if (delError) return setError(`Not deleted: ${delError.message}`);
    setMessages((list) => list.filter((x) => x.id !== m.id));
  };

  // @mentions: typing "@" and some letters offers matching people.
  const onType = (value: string) => {
    setText(value);
    const caret = boxRef.current?.selectionStart ?? value.length;
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(value.slice(0, caret));
    setMention(m ? { query: m[2].toLowerCase(), start: caret - m[2].length - 1 } : null);
  };
  const choices = mention
    ? people.filter((p) => memberIds.includes(p.id) && p.id !== userId && p.name.toLowerCase().includes(mention.query)).slice(0, 6)
    : [];
  const pick = (p: ChatPerson) => {
    if (!mention) return;
    const caret = boxRef.current?.selectionStart ?? text.length;
    setText(`${text.slice(0, mention.start)}@${p.name} ${text.slice(caret)}`);
    setMention(null);
    boxRef.current?.focus();
  };

  const allNames = people.map((p) => p.name);
  // Day headings, "New" line and grouping of messages from the same person.
  const firstUnreadId = firstUnreadAfter ? messages.find((m) => m.author_id !== userId && m.created_at > firstUnreadAfter)?.id : undefined;
  const rows = messages.map((m, i) => {
    const prev = messages[i - 1];
    const day = dayLabel(m.created_at);
    const newDay = !prev || dayLabel(prev.created_at) !== day;
    const grouped = !newDay && prev.author_id === m.author_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60 * 1000;
    return { m, day, newDay, grouped, showUnread: m.id === firstUnreadId };
  });

  return (
    <>
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="min-h-0 flex-1 overflow-y-auto bg-fp-offwhite px-3 py-3 sm:px-4"
        aria-live="polite"
      >
        {hasOlder && (
          <div className="mb-3 text-center">
            <button type="button" onClick={loadOlder} className="rounded-full bg-white px-3 py-1 text-xs font-semibold ring-1 ring-fp-border hover:bg-fp-light">
              Show earlier messages
            </button>
          </div>
        )}
        {messages.length === 0 && <p className="py-10 text-center text-sm text-fp-mid">No messages yet. Say hello!</p>}
        {rows.map(({ m, day, newDay, grouped, showUnread }) => {
          const mine = m.author_id === userId;
          const mentionsMe = m.mentions.includes(userId);
          return (
            <Fragment key={m.id}>
              {newDay && (
                <p className="my-3 text-center text-xs font-semibold text-fp-mid">
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-fp-border">{day}</span>
                </p>
              )}
              {showUnread && (
                <p className="my-2 flex items-center gap-2 text-xs font-bold text-fp-pink">
                  <span className="h-px flex-1 bg-fp-pink/40" /> New <span className="h-px flex-1 bg-fp-pink/40" />
                </p>
              )}
              <div className={`group relative rounded-md px-2 ${grouped ? "py-0.5" : "mt-2 py-1"} ${mentionsMe ? "bg-fp-pink/5" : "hover:bg-white"}`}>
                {!grouped && (
                  <p className="text-sm">
                    <span className="font-bold">{nameOf(m.author_id)}</span> <span className="text-xs text-fp-mid">{time(m.created_at)}</span>
                  </p>
                )}
                {editing?.id === m.id ? (
                  <div className="grid gap-1">
                    <textarea
                      value={editing.body}
                      onChange={(e) => setEditing({ id: m.id, body: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void saveEdit();
                        }
                        if (e.key === "Escape") setEditing(null);
                      }}
                      rows={2}
                      maxLength={MAX_MESSAGE_LENGTH}
                      autoFocus
                      aria-label="Edit message"
                      className="w-full rounded-md border border-fp-border bg-white px-2 py-1 text-sm focus:border-fp-pink focus:outline-none"
                    />
                    <p className="text-xs text-fp-mid">
                      Enter to save · Esc to cancel{" "}
                      <button type="button" onClick={() => setEditing(null)} className="font-semibold text-fp-teal-deep hover:underline">
                        Cancel
                      </button>
                    </p>
                  </div>
                ) : (
                  <div className="text-sm">
                    {m.body && <Body text={m.body} mentionNames={allNames} mine={myName} />}
                    {m.edited_at && <span className="text-xs text-fp-mid"> (edited)</span>}
                  </div>
                )}
                {m.attachments.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {m.attachments.map((a) =>
                      a.type.startsWith("image/") && urls[a.path] ? (
                        <a key={a.path} href={urls[a.path]} target="_blank" rel="noopener noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element -- private, short-lived links */}
                          <img src={urls[a.path]} alt={a.name} className="max-h-48 max-w-xs rounded-md ring-1 ring-fp-border" />
                        </a>
                      ) : (
                        <a
                          key={a.path}
                          href={urls[a.path] ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-xs ring-1 ring-fp-border hover:ring-fp-pink"
                        >
                          <FileText size={14} aria-hidden className="text-fp-mid" />
                          <span className="max-w-48 truncate font-semibold">{a.name}</span>
                          <span className="text-fp-mid">{sizeLabel(a.size)}</span>
                        </a>
                      ),
                    )}
                  </div>
                )}
                {mine && !readOnly && editing?.id !== m.id && (
                  <div className="absolute right-1 top-0 hidden gap-0.5 rounded-md bg-white p-0.5 shadow ring-1 ring-fp-border group-focus-within:flex group-hover:flex">
                    <button type="button" onClick={() => setEditing({ id: m.id, body: m.body })} aria-label="Edit message" className="rounded p-1 hover:bg-fp-light">
                      <Pencil size={13} aria-hidden />
                    </button>
                    <button type="button" onClick={() => void remove(m)} aria-label="Delete message" className="rounded p-1 text-fp-error hover:bg-fp-light">
                      <Trash2 size={13} aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>

      {readOnly ? (
        <p className="border-t border-fp-border bg-white px-4 py-3 text-sm text-fp-mid">This channel is archived, so it&apos;s read only.</p>
      ) : (
        <div className="relative border-t border-fp-border bg-white px-3 py-2 sm:px-4">
          {choices.length > 0 && (
            <ul role="listbox" aria-label="People to mention" className="absolute bottom-full left-3 mb-1 w-64 overflow-hidden rounded-md bg-white text-sm shadow-lg ring-1 ring-fp-border">
              {choices.map((p) => (
                <li key={p.id}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)} className="block w-full px-3 py-1.5 text-left hover:bg-fp-light">
                    @{p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p role="alert" className="mb-1 text-xs text-fp-error">
              {error}
            </p>
          )}
          {files.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {files.map((f) => (
                <li key={f.path} className="flex items-center gap-1 rounded-md bg-fp-light px-2 py-1 text-xs">
                  <FileText size={12} aria-hidden />
                  <span className="max-w-40 truncate">{f.name}</span>
                  {f.uploading ? (
                    <span className="text-fp-mid">uploading…</span>
                  ) : (
                    <button type="button" onClick={() => void removeFile(f.path)} aria-label={`Remove ${f.name}`} className="rounded hover:bg-white">
                      <X size={12} aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <label className="cursor-pointer rounded-md p-2 text-fp-mid hover:bg-fp-light" title="Attach files (up to 20 MB each)">
              <Paperclip size={18} aria-hidden />
              <span className="sr-only">Attach files</span>
              <input ref={fileRef} type="file" multiple onChange={(e) => void upload(e.target.files)} className="sr-only" />
            </label>
            <textarea
              ref={boxRef}
              value={text}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => {
                if (choices.length && (e.key === "Enter" || e.key === "Tab")) {
                  e.preventDefault();
                  pick(choices[0]);
                  return;
                }
                if (e.key === "Escape") setMention(null);
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={Math.min(6, Math.max(1, text.split("\n").length))}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={placeholder}
              aria-label="Message"
              className="min-h-10 flex-1 resize-none rounded-md border border-fp-border px-3 py-2 text-sm focus:border-fp-pink focus:outline-none focus:ring-2 focus:ring-fp-pink/20"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || (!text.trim() && !files.length) || files.some((f) => f.uploading)}
              aria-label="Send"
              className="rounded-md bg-fp-pink p-2.5 text-white hover:bg-fp-pink/90 disabled:opacity-40"
            >
              <SendHorizontal size={18} aria-hidden />
            </button>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-fp-mid">
            <span>Enter to send · Shift+Enter for a new line · @ to mention someone</span>
            {alerts === "default" && (
              <button
                type="button"
                onClick={() => void Notification.requestPermission().then(setAlerts)}
                className="inline-flex items-center gap-1 font-semibold text-fp-teal-deep hover:underline"
              >
                <Bell size={11} aria-hidden /> Alert me to new messages
              </button>
            )}
          </p>
        </div>
      )}
    </>
  );
}

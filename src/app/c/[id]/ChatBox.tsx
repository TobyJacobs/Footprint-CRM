"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { loadChat, sendChat, sendChatDetails, type ChatState } from "./actions";

const input =
  "w-full rounded-md border border-fp-border bg-white px-3 py-2 text-sm focus:border-fp-pink focus:outline-none focus:ring-2 focus:ring-fp-pink/20";

// The visitor's random code, kept in this browser so the chat carries on
// between pages. If storage is blocked, it lasts for this visit only.
function visitorCode(publicId: string) {
  const key = `fpos-chat-${publicId}`;
  try {
    const kept = localStorage.getItem(key);
    if (kept && /^[0-9a-f]{32,64}$/.test(kept)) return kept;
  } catch {}
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const code = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    localStorage.setItem(key, code);
  } catch {}
  return code;
}

export default function ChatBox({
  publicId,
  siteName,
  greeting,
  privacyUrl,
  page,
  embed,
}: {
  publicId: string;
  siteName: string;
  greeting: string;
  privacyUrl: string | null;
  page: string;
  embed: boolean;
}) {
  // Read in the browser only (the page is first drawn on the server).
  const [visitor] = useState(() => (typeof window === "undefined" ? "" : visitorCode(publicId)));
  const [chat, setChat] = useState<ChatState>({ status: "new", hasDetails: false, messages: [] });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visitor) loadChat(publicId, visitor).then(setChat);
  }, [publicId, visitor]);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [chat.messages.length, busy, chat.status]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy || !visitor) return;
    setBusy(true);
    setText("");
    setChat((c) => ({ ...c, error: undefined, messages: [...c.messages, { role: "visitor", body }] }));
    setChat(await sendChat(publicId, visitor, body, page));
    setBusy(false);
  };

  const sendDetails = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setChat(await sendChatDetails(publicId, visitor, String(fd.get("name") ?? ""), String(fd.get("email") ?? ""), String(fd.get("phone") ?? "")));
    setBusy(false);
  };

  const askDetails = chat.status === "handover" && !chat.hasDetails;
  return (
    <div className="flex h-full flex-col text-sm">
      <header className="flex items-center justify-between bg-fp-black px-4 py-3 text-white">
        <div>
          <p className="font-bold">{siteName}</p>
          <p className="text-xs text-white/70">Automated assistant · a person takes over when needed</p>
        </div>
        {embed && (
          <button type="button" aria-label="Close the chat" onClick={() => parent.postMessage({ fposChat: publicId, close: true }, "*")} className="rounded p-1 hover:bg-white/10">
            <X size={18} aria-hidden />
          </button>
        )}
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto bg-fp-offwhite p-3" aria-live="polite">
        <Bubble role="bot" body={greeting} />
        {chat.messages.map((m, i) => (
          <Bubble key={i} role={m.role} body={m.body} />
        ))}
        {busy && <p className="text-xs text-fp-mid">Typing…</p>}
        {askDetails && (
          <form onSubmit={sendDetails} className="grid gap-2 rounded-lg border border-fp-border bg-white p-3">
            <p className="font-semibold">Your details for the team</p>
            <input name="name" required maxLength={200} autoComplete="name" placeholder="Your name" aria-label="Your name" className={input} />
            <input name="email" type="email" required maxLength={320} autoComplete="email" placeholder="Email address" aria-label="Email address" className={input} />
            <input name="phone" type="tel" maxLength={50} autoComplete="tel" placeholder="Phone (optional)" aria-label="Phone" className={input} />
            <button type="submit" disabled={busy} className="rounded-md bg-fp-pink px-4 py-2 font-bold text-white hover:bg-fp-pink/90 disabled:opacity-50">
              Send to the team
            </button>
          </form>
        )}
        {chat.status === "handover" && chat.hasDetails && (
          <p className="rounded-md bg-fp-teal/10 px-3 py-2 text-xs text-fp-teal-deep">Thanks! The team has your details and will be in touch soon.</p>
        )}
        {chat.error && (
          <p role="alert" className="rounded-md border border-fp-error/30 bg-fp-error/5 px-3 py-2 text-xs text-fp-error">
            {chat.error}
          </p>
        )}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-fp-border p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Type your message…"
          aria-label="Your message"
          className={input}
        />
        <button type="submit" disabled={busy || !text.trim()} className="rounded-md bg-fp-pink px-4 font-bold text-white disabled:opacity-50">
          Send
        </button>
      </form>
      <p className="px-3 pb-2 text-[11px] text-fp-mid">
        Chats are kept for 12 months to help us reply.{" "}
        {privacyUrl && (
          <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Privacy policy
          </a>
        )}
      </p>
    </div>
  );
}

function Bubble({ role, body }: { role: "visitor" | "bot"; body: string }) {
  return (
    <div className={`flex ${role === "visitor" ? "justify-end" : "justify-start"}`}>
      <p className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 ${role === "visitor" ? "bg-fp-pink text-white" : "border border-fp-border bg-white"}`}>{body}</p>
    </div>
  );
}

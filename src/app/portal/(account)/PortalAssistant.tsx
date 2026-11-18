"use client";

import Link from "next/link";
import { MessageCircle, RotateCcw, Send, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/ui";
import { clearPortalBot, handOverPortalBot, loadPortalBot, sendPortalBot, type BotChat } from "../actions";

// The portal assistant: a chat bubble in the corner of every portal page. A
// bot answers from the customer's own records; "Send to the team" turns the
// chat into a Customer support conversation.
export default function PortalAssistant({ companies }: { companies: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<BotChat | null>(null);
  const [text, setText] = useState("");
  const [company, setCompany] = useState(companies[0]?.id ?? "");
  const [sent, setSent] = useState<string | null>(null);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !chat) start(async () => setChat(await loadPortalBot()));
  }, [open, chat]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [chat, pending, open]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || pending) return;
    setText("");
    setSent(null);
    setHandoverError(null);
    // Show their message straight away while the bot thinks.
    setChat((c) => (c ? { ...c, error: undefined, messages: [...c.messages, { role: "customer", body }] } : c));
    start(async () => setChat(await sendPortalBot(body)));
  };

  const handOver = () =>
    start(async () => {
      const r = await handOverPortalBot(company);
      if (r.ticketId) {
        setSent(r.ticketId);
        setChat(await loadPortalBot());
      } else setHandoverError(r.error ?? "Sorry, that didn't work.");
    });

  const restart = () =>
    start(async () => {
      setSent(null);
      setHandoverError(null);
      setChat(await clearPortalBot());
    });

  const hasChat = (chat?.messages.length ?? 0) > 0;

  return (
    <div className="fixed bottom-4 right-4 z-30 print:hidden">
      {open && (
        <div
          role="dialog"
          aria-label="Ask the assistant"
          className="mb-3 flex h-[min(560px,calc(100vh-7rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-fp-border bg-white shadow-2xl"
        >
          <div className="bg-fp-gradient h-1" />
          <div className="flex items-center justify-between bg-fp-black px-4 py-3 text-white">
            <div>
              <p className="text-sm font-bold">Ask the assistant</p>
              <p className="text-xs text-white/60">Answers about your account, any time</p>
            </div>
            <div className="flex items-center gap-1">
              {hasChat && (
                <button type="button" onClick={restart} disabled={pending} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white" title="Start again">
                  <RotateCcw size={16} aria-hidden />
                  <span className="sr-only">Start again</span>
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                <X size={18} aria-hidden />
                <span className="sr-only">Close</span>
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-fp-offwhite px-4 py-4 text-sm" aria-live="polite">
            {!chat && <p className="text-fp-mid">Loading…</p>}
            {chat && (chat.enabled || hasChat) && <Bubble fromUs>{chat.greeting}</Bubble>}
            {chat && !chat.enabled && !chat.error && (
              <p className="rounded-md bg-white p-3 text-fp-mid">
                The assistant is switched off at the moment. You can send us a message in{" "}
                <Link href="/portal/support/new" className="font-semibold text-fp-pink underline" onClick={() => setOpen(false)}>
                  Support
                </Link>
                .
              </p>
            )}
            {chat?.messages.map((m, i) => (
              <Bubble key={i} fromUs={m.role === "bot"}>
                {m.body}
              </Bubble>
            ))}
            {pending && chat && <p className="text-xs text-fp-mid">Thinking…</p>}
            {chat?.error && <p className="rounded-md bg-red-50 p-3 text-red-700">{chat.error}</p>}
            {sent && (
              <p className="rounded-md bg-teal-50 p-3 text-teal-800">
                Sent to the team. They&apos;ll reply in{" "}
                <Link href={`/portal/support/${sent}`} className="font-semibold underline" onClick={() => setOpen(false)}>
                  Support
                </Link>{" "}
                and we&apos;ll email you when they do.
              </p>
            )}
            {hasChat && !sent && (
              <div className={`rounded-md border p-3 ${chat?.suggestHandover ? "border-fp-pink bg-white" : "border-fp-border bg-white/60"}`}>
                <p className="text-xs text-fp-dark">{chat?.suggestHandover ? "Want a person to pick this up?" : "Need a person?"}</p>
                {companies.length > 1 && (
                  <label className="mt-2 grid gap-1 text-xs">
                    <span className="text-fp-mid">For</span>
                    <select value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass}>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  onClick={handOver}
                  disabled={pending}
                  className="mt-2 rounded-md bg-fp-pink px-3 py-1.5 text-xs font-semibold text-white hover:bg-fp-pink/90 disabled:opacity-50"
                >
                  Send to the team
                </button>
                {handoverError && <p className="mt-2 text-xs text-red-700">{handoverError}</p>}
              </div>
            )}
            <div ref={bottom} />
          </div>

          {chat?.enabled && (
            <form onSubmit={send} className="flex items-end gap-2 border-t border-fp-border p-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) send(e);
                }}
                rows={1}
                maxLength={1000}
                placeholder="Ask about an order, invoice, proof…"
                aria-label="Your message"
                className={`${inputClass} max-h-28 resize-none`}
              />
              <button type="submit" disabled={pending || !text.trim()} className="rounded-md bg-fp-pink p-2.5 text-white hover:bg-fp-pink/90 disabled:opacity-40">
                <Send size={16} aria-hidden />
                <span className="sr-only">Send</span>
              </button>
            </form>
          )}
          <p className="border-t border-fp-border bg-white px-3 py-1.5 text-[11px] text-fp-mid">
            An AI assistant: it reads your account to answer and can make mistakes. It can&apos;t change anything.
          </p>
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-full bg-fp-pink px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-fp-pink/90"
        >
          {open ? <X size={18} aria-hidden /> : <MessageCircle size={18} aria-hidden />}
          {open ? "Close" : "Ask a question"}
        </button>
      </div>
    </div>
  );
}

function Bubble({ fromUs, children }: { fromUs: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex ${fromUs ? "justify-start" : "justify-end"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
          fromUs ? "rounded-bl-sm bg-white text-fp-dark shadow-sm" : "rounded-br-sm bg-fp-pink text-white"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

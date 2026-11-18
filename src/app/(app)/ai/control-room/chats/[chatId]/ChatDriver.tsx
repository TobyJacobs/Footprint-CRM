"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { inputClass } from "@/components/ui";
import { botTurn } from "../../actions";

// Lets the bots take turns: everyone once per round, or one bot on its own.
// Each reply appears as soon as it's written.
export default function ChatDriver({ chatId, bots, startNow }: { chatId: string; bots: { id: string; name: string }[]; startNow: boolean }) {
  const router = useRouter();
  const [rounds, setRounds] = useState(1);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  const started = useRef(false);

  const talk = async (order: { id: string; name: string }[]) => {
    stop.current = false;
    setError(null);
    for (const b of order) {
      if (stop.current) break;
      setSpeaking(b.name);
      const r = await botTurn(chatId, b.id).catch(() => ({ ok: false, error: `${b.name} didn't answer` }));
      router.refresh();
      if (!r.ok) {
        setError(r.error ?? "Something went wrong");
        break;
      }
    }
    setSpeaking(null);
  };

  useEffect(() => {
    if (startNow && !started.current) {
      started.current = true;
      void talk(bots);
      router.replace(`/ai/control-room/chats/${chatId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (speaking) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-fp-black px-3 py-2 text-sm text-white">
        <span className="flex gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fp-pink-light [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fp-pink-light [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fp-pink-light" />
        </span>
        <span className="flex-1 font-mono text-xs">{speaking} is writing…</span>
        <button type="button" className="rounded-md px-2 py-1 text-xs font-semibold text-white/70 ring-1 ring-white/20 hover:bg-white/10 hover:text-white" onClick={() => (stop.current = true)}>
          Stop after this one
        </button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-fp-black px-3 py-1.5 text-xs font-bold text-white hover:bg-fp-dark"
          onClick={() => talk(Array.from({ length: rounds }, () => bots).flat())}
        >
          <Zap size={13} aria-hidden className="text-fp-pink-light" /> Let them talk
        </button>
        <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className={`${inputClass} w-auto py-1 text-xs`} aria-label="How many rounds">
          <option value={1}>Each bot once</option>
          <option value={2}>2 rounds</option>
          <option value={3}>3 rounds</option>
        </select>
        <span className="text-xs text-fp-mid">or ask one:</span>
        {bots.map((b) => (
          <button key={b.id} type="button" className="rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-fp-border hover:bg-fp-light hover:ring-fp-pink" onClick={() => talk([b])}>
            {b.name}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-fp-error">{error}</p>}
    </div>
  );
}

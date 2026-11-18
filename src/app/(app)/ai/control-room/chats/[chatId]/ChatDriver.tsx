"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";
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
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-fp-amber/40 bg-fp-amber/10 px-4 py-3 text-sm">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-fp-dark/30 border-t-fp-dark" aria-hidden />
        <span className="flex-1">{speaking} is writing…</span>
        <button type="button" className={secondaryButton} onClick={() => (stop.current = true)}>
          Stop after this one
        </button>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={primaryButton} onClick={() => talk(Array.from({ length: rounds }, () => bots).flat())}>
          Let them talk
        </button>
        <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className={`${inputClass} w-auto`} aria-label="How many rounds">
          <option value={1}>Each bot once</option>
          <option value={2}>2 rounds</option>
          <option value={3}>3 rounds</option>
        </select>
        <span className="text-xs text-fp-mid">or ask one:</span>
        {bots.map((b) => (
          <button key={b.id} type="button" className={secondaryButton} onClick={() => talk([b])}>
            {b.name}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-fp-error">{error}</p>}
    </div>
  );
}

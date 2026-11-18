"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { secondaryButton } from "@/components/ui";
import { continueRun, stopRun } from "../../actions";

// Keeps the person's own run going one step at a time, refreshing the page
// after each step so they see what the bot did.
export default function RunDriver({ runId }: { runId: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(true);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    (async () => {
      for (let i = 0; i < 15 && !stopped.current; i++) {
        const outcome = await continueRun(runId).catch(() => ({ status: "failed" as const }));
        router.refresh();
        if (outcome.status !== "running") break;
      }
      setWorking(false);
    })();
    return () => {
      stopped.current = true;
    };
  }, [runId, router]);

  if (!working) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-fp-amber/40 bg-fp-amber/10 px-4 py-3 text-sm">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-fp-dark/30 border-t-fp-dark" aria-hidden />
      <span className="flex-1">The bot is working on it. Keep this page open.</span>
      <button
        type="button"
        className={secondaryButton}
        onClick={async () => {
          stopped.current = true;
          await stopRun(runId);
          setWorking(false);
          router.refresh();
        }}
      >
        Stop
      </button>
    </div>
  );
}

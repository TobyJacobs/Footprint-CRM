"use client";

import { useState } from "react";
import { secondaryButton } from "@/components/ui";
import { makeBotKey } from "../../actions";

// Makes a new key for an outside bot and shows it once.
export default function KeyMaker({ botId, hasKey }: { botId: string; hasKey: boolean }) {
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (key) {
    return (
      <div className="grid gap-2">
        <p className="text-sm font-semibold">Copy this key now and put it in the outside bot&apos;s settings. It won&apos;t be shown again.</p>
        <code className="block break-all rounded-md border border-fp-border bg-fp-offwhite p-3 text-xs">{key}</code>
        <p className="text-xs text-fp-mid">Keep it secret, like a password: never paste it into a chat or a document.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <div>
        <button
          type="button"
          disabled={busy}
          className={secondaryButton}
          onClick={async () => {
            if (hasKey && !confirm("Make a new key? The old key will stop working straight away.")) return;
            setBusy(true);
            const r = await makeBotKey(botId);
            setBusy(false);
            if (r.key) setKey(r.key);
            else setError(r.error ?? "Couldn't make a key");
          }}
        >
          {hasKey ? "Make a new key" : "Make a key"}
        </button>
      </div>
      {error && <p className="text-sm text-fp-error">{error}</p>}
    </div>
  );
}

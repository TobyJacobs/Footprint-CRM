"use client";

import { useActionState } from "react";
import { createDirectorySyncKey } from "../actions";
import { primaryButton, secondaryButton } from "@/components/ui";
import CopyButton from "@/components/CopyButton";

// Creates the daily-sync key and shows it ONCE so it can be pasted into
// Netlify. It is never stored in readable form.
export default function SyncKeyCard({ keySetAt }: { keySetAt: string | null }) {
  const [state, action, pending] = useActionState(async () => createDirectorySyncKey(), {} as { key?: string; error?: string });

  return (
    <div className="grid gap-3 text-sm">
      <p className="text-fp-dark/75">
        The daily automatic sync needs a secret key in Netlify called <code>DIRECTORY_SYNC_KEY</code>.
        {keySetAt ? ` A key was created on ${keySetAt}.` : " No key has been created yet."} Creating a new key
        stops the old one working.
      </p>
      {state.key ? (
        <div className="rounded-md border border-fp-amber bg-fp-amber/10 p-3">
          <p className="mb-2 font-semibold">Copy this key now and paste it into Netlify. It won&apos;t be shown again.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 text-xs">{state.key}</code>
            <CopyButton text={state.key} label="Copy key" />
          </div>
        </div>
      ) : (
        <form action={action}>
          <button type="submit" disabled={pending} className={keySetAt ? secondaryButton : primaryButton}>
            {pending ? "Creating…" : keySetAt ? "Create a new key" : "Create sync key"}
          </button>
        </form>
      )}
      {state.error && <p className="text-fp-error">{state.error}</p>}
    </div>
  );
}

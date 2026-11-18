"use client";

import { useRef } from "react";

const options = [
  ["not_started", "Not started"],
  ["in_progress", "In progress"],
  ["blocked", "Blocked"],
  ["done", "Done"],
] as const;
const colours: Record<string, string> = {
  not_started: "border-fp-border bg-white text-fp-dark",
  in_progress: "border-fp-amber/60 bg-fp-amber/10 text-fp-dark",
  blocked: "border-fp-error/50 bg-fp-error/10 text-fp-error",
  done: "border-fp-teal-deep/40 bg-fp-teal/15 text-fp-teal-deep",
};

// Change an action's status in place: picking one saves it straight away.
export default function StatusSelect({
  status,
  action,
  back,
  disabled,
}: {
  status: string;
  action: (fd: FormData) => Promise<void>;
  back: string;
  disabled?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="back" value={back} />
      <select
        name="status"
        defaultValue={status}
        disabled={disabled}
        aria-label="Status"
        onChange={() => form.current?.requestSubmit()}
        className={`rounded-full border px-2 py-1 text-xs font-semibold ${colours[status] ?? ""} disabled:opacity-100`}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </form>
  );
}

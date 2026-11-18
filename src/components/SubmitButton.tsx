"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// A form's submit button that says what's happening while the form is being
// sent (e.g. "Signing in…"), so a slow moment doesn't look like nothing
// happened. It can't be pressed twice meanwhile.
export default function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={`${className ?? ""} disabled:cursor-wait disabled:opacity-70`}>
      {pending ? pendingLabel : children}
    </button>
  );
}

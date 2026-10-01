"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

// Shown if something goes badly wrong anywhere in the platform. The error is
// reported to Sentry so we hear about it.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-GB">
      <body className="flex min-h-screen items-center justify-center bg-fp-black px-4 font-sans">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-lg font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-fp-dark/75">
            The problem has been reported automatically. Please try again — if it keeps happening,
            let an admin know{error.digest ? ` and quote reference ${error.digest}` : ""}.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-fp-pink px-4 py-2 text-sm font-semibold text-white hover:bg-fp-pink/90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

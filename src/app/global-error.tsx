"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

// Next.js raises this when a page left open from an older release presses a
// button the new release no longer knows about. A refresh always fixes it.
function isOldVersionError(error: Error) {
  return error.name === "UnrecognizedActionError";
}

// Shown if something goes badly wrong anywhere in the platform. The error is
// reported to Sentry so we hear about it.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const oldVersion = isOldVersionError(error);

  useEffect(() => {
    // An out-of-date page isn't a bug, so don't raise an alert for it.
    if (!oldVersion) Sentry.captureException(error);
  }, [error, oldVersion]);

  return (
    <html lang="en-GB">
      <body className="flex min-h-screen items-center justify-center bg-fp-black px-4 font-sans">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-xl">
          {oldVersion ? (
            <>
              <h1 className="text-lg font-bold">FootprintOS has just been updated</h1>
              <p className="mt-2 text-sm text-fp-dark/75">
                A new version went live while you had this page open. Please refresh to carry on —
                anything you typed on this page may need entering again.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 rounded-md bg-fp-pink px-4 py-2 text-sm font-semibold text-white hover:bg-fp-pink/90"
              >
                Refresh
              </button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold">Something went wrong</h1>
              <p className="mt-2 text-sm text-fp-dark/75">
                The problem has been reported automatically. Please try again — if it keeps
                happening, let an admin know
                {error.digest ? ` and quote reference ${error.digest}` : ""}.
              </p>
              <button
                type="button"
                onClick={reset}
                className="mt-6 rounded-md bg-fp-pink px-4 py-2 text-sm font-semibold text-white hover:bg-fp-pink/90"
              >
                Try again
              </button>
            </>
          )}
        </div>
      </body>
    </html>
  );
}

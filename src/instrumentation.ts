import * as Sentry from "@sentry/nextjs";

// Next.js runs this once when the server starts; it switches on error alerts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Send server-side errors (pages, server actions, the proxy) to Sentry.
export const onRequestError = Sentry.captureRequestError;

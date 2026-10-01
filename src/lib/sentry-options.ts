// Shared settings for Sentry error alerts (browser, server and edge).
//
// We only send *errors* — no performance tracing and no session recordings —
// and we switch off everything that could carry personal data (UK GDPR):
// no user details, cookies, headers, request bodies, query strings or
// variable values. Sentry stores our data in its EU (Frankfurt) region.
//
// Alerts are off until NEXT_PUBLIC_SENTRY_DSN is set in Netlify (and
// optionally .env.local). The DSN only lets someone *send* errors to our
// project, so Sentry treats it as safe to be public.
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NODE_ENV,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
  },
};

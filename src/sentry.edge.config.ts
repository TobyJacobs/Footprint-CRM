import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

// Error alerts for the login check that runs before every page (src/proxy.ts).
Sentry.init(sentryOptions);

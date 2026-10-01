import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

// Error alerts for problems on the server (pages, admin actions, sign-in).
Sentry.init(sentryOptions);

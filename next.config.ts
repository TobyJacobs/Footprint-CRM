import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Standard browser security settings, sent with every page.
const securityHeaders = [
  // Always use HTTPS for this site (one year), including subdomains.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Don't let browsers guess file types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only tell other sites which domain a visitor came from, never the full page address.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The platform doesn't need the camera, microphone or location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Don't let other websites show the platform inside a frame (stops
// click-jacking), except the public flipbooks and enquiry forms, which
// Footprint's own websites may show.
const footprintSites = [
  "https://forgetmenotonline.org",
  "https://*.forgetmenotonline.org",
  "https://footprintgroup.uk",
  "https://*.footprintgroup.uk",
];

// FootprintOS's live address (owner, 18 November 2026; was footprintgroupos.netlify.app).
const LIVE_SITE = "https://os.footprintgroup.uk";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    // The site's own address (used by src/lib/site-url.ts): the live site is
    // always https://os.footprintgroup.uk (owner, 18 November 2026), whichever
    // address someone used to reach it. A preview uses its own address
    // (DEPLOY_PRIME_URL, from Netlify while building). Empty on a computer.
    SITE_URL: process.env.CONTEXT === "production" ? LIVE_SITE : (process.env.DEPLOY_PRIME_URL ?? ""),
  },
  headers() {
    return [
      // Everything except the flipbooks, forms, chat and advert booking: never shown inside another site.
      { source: "/((?!read/|f/|c/|book$).*)", headers: [...securityHeaders, { key: "X-Frame-Options", value: "DENY" }] },
      // Flipbooks (/read/…), enquiry forms (/f/…) and the website chat (/c/…)
      // may be shown inside Footprint's own websites.
      // Online advert booking (/book) too (owner, 18 November 2026).
      ...["/read/:path*", "/f/:path*", "/c/:path*", "/book"].map((source) => ({
        source,
        headers: [...securityHeaders, { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${footprintSites.join(" ")}` }],
      })),
    ];
  },
};

// Adds Sentry error alerts (settings in src/lib/sentry-options.ts). Source-map
// upload is off: it would need a secret Sentry token in Netlify.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  sourcemaps: { disable: true },
  telemetry: false,
});

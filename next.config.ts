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
// click-jacking), except the public flipbooks, which Footprint's own websites
// may show.
const flipbookSites = [
  "https://forgetmenotonline.org",
  "https://*.forgetmenotonline.org",
  "https://footprintgroup.uk",
  "https://*.footprintgroup.uk",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    // The site's own address (used by src/lib/site-url.ts). Netlify provides
    // these while building: URL is the main address, DEPLOY_PRIME_URL a
    // preview's. Empty when running on a computer.
    SITE_URL:
      (process.env.CONTEXT === "production" ? process.env.URL : process.env.DEPLOY_PRIME_URL) ?? "",
  },
  headers() {
    return [
      // Everything except the public flipbooks: never shown inside another site.
      { source: "/((?!read/).*)", headers: [...securityHeaders, { key: "X-Frame-Options", value: "DENY" }] },
      // Flipbooks (/read/…) may be shown inside Footprint's own websites.
      {
        source: "/read/:path*",
        headers: [...securityHeaders, { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${flipbookSites.join(" ")}` }],
      },
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

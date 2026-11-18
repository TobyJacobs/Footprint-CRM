import { headers } from "next/headers";

// The platform's own web address, for sign-in and for links we email out.
// On Netlify this is fixed when the site is built (see next.config.ts): the
// main address for the live site, or the preview's address for a preview. We
// don't trust the address a request came in on, because Netlify's skew
// protection can answer from a release-specific address
// (<release id>--footprintgroupos.netlify.app), and sign-in or links sent from
// there wouldn't work on the main address.
export async function siteUrl(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  // Running on a computer (not Netlify): use the address in the browser.
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

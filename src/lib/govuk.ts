import "server-only";

// Free articles from GOV.UK for the magazine (owner, 9 November 2026: only
// articles that cost nothing). GOV.UK's search and content services are free
// and need no key, and its text may be reused under the Open Government
// Licence v3.0 as long as the credit line is printed with it. Pictures,
// logos and anything marked as someone else's aren't covered, so only the
// text is taken.

export const GOVUK_CREDIT = "Contains public sector information licensed under the Open Government Licence v3.0. Source: GOV.UK.";

export type GovukResult = { title: string; description: string; link: string; format: string; date: string | null };

export async function searchGovuk(query: string): Promise<GovukResult[]> {
  const q = query.trim().slice(0, 100);
  if (!q) return [];
  const params = new URLSearchParams({ q, count: "15" });
  for (const f of ["title", "description", "link", "format", "public_timestamp"]) params.append("fields", f);
  const res = await fetch(`https://www.gov.uk/api/search.json?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error("GOV.UK search isn't answering right now. Please try again.");
  const data = (await res.json()) as { results?: { title?: string; description?: string; link?: string; format?: string; public_timestamp?: string }[] };
  return (data.results ?? [])
    .filter((r) => r.title && r.link?.startsWith("/"))
    .map((r) => ({ title: r.title!, description: (r.description ?? "").trim(), link: r.link!, format: r.format ?? "", date: r.public_timestamp?.slice(0, 10) ?? null }));
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", pound: "£", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

// GOV.UK page HTML as plain text: headings and paragraphs on their own lines,
// bullet points kept, everything else (pictures, links' addresses) dropped.
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style|figure|svg)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|h[1-6]|ul|ol|div|blockquote|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h[1-6][^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n•/g, "\n•")
    // A bullet whose text was in its own block: keep them on one line.
    .replace(/•[ \t]*\n+(?!•)/g, "• ")
    .replace(/\n•[ \t]*(?=\n|$)/g, "")
    .trim();
}

// One GOV.UK page's title and text (guides are made of parts: each part's
// title becomes a heading).
export async function fetchGovukArticle(link: string): Promise<{ title: string; body: string; url: string }> {
  if (!/^\/[A-Za-z0-9/_.-]+$/.test(link)) throw new Error("That isn't a GOV.UK page");
  const res = await fetch(`https://www.gov.uk/api/content${link}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error("Couldn't get that page from GOV.UK. Please try again.");
  const data = (await res.json()) as { title?: string; description?: string; details?: { body?: string; parts?: { title?: string; body?: string }[] } };
  const details = data.details ?? {};
  const html =
    typeof details.body === "string" && details.body
      ? details.body
      : (details.parts ?? []).map((p) => `<h2>${p.title ?? ""}</h2>${p.body ?? ""}`).join("");
  const body = htmlToText(html) || (data.description ?? "").trim();
  if (!data.title || !body) throw new Error("That GOV.UK page has no article text to use");
  return { title: data.title.slice(0, 200), body: body.slice(0, 30000), url: `https://www.gov.uk${link}` };
}

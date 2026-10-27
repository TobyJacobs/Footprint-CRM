import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { supabaseUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import Flipbook from "./Flipbook";

type FlipbookData = { code: string; name: string; slug: string; month: string; path: string; months: string[] };

const monthLabel = (m: string) =>
  new Date(`${m.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export async function loadFlipbook(slug: string, month: string | null) {
  await connection();
  if (!/^[a-z0-9-]{1,80}$/i.test(slug) || (month !== null && !/^\d{4}-\d{2}$/.test(month))) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_flipbook", { p_slug: slug, p_month: month ? `${month}-01` : null });
  return (data as FlipbookData | null) ?? null;
}

export const flipbookTitle = (f: FlipbookData) => `Forget Me Not ${f.name} · ${monthLabel(f.month)}`;

// The public flipbook page: a slim Forget Me Not header (left out when shown
// inside another website with ?embed=1), the book, and links to other issues.
export default function ReadView({ book, embed }: { book: FlipbookData | null; embed: boolean }) {
  if (!book) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fp-offwhite px-4">
        <p className="text-center text-sm text-fp-dark/75">This issue isn&apos;t available to read online yet.</p>
      </main>
    );
  }
  const pdfUrl = `${supabaseUrl}/storage/v1/object/public/flipbooks/${book.path.split("/").map(encodeURIComponent).join("/")}`;
  const title = flipbookTitle(book);
  return (
    <main className={`min-h-screen bg-fp-offwhite ${embed ? "p-2" : ""}`}>
      {!embed && (
        <header className="bg-fp-black">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Image src="/brand/footprint-logo-white.png" alt="Footprint Group" width={130} height={38} />
            <h1 className="text-sm font-semibold text-white">{title}</h1>
          </div>
        </header>
      )}
      <div className={embed ? "" : "px-4 py-6"}>
        <Flipbook pdfUrl={pdfUrl} title={title} />
      </div>
      {!embed && book.months.length > 1 && (
        <nav aria-label="Other issues" className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2 px-4 pb-8 text-sm">
          {book.months.map((m) => {
            const ym = m.slice(0, 7);
            const current = ym === book.month.slice(0, 7);
            return (
              <Link
                key={m}
                href={`/read/${book.slug}/${ym}`}
                aria-current={current ? "page" : undefined}
                className={`rounded-full border px-3 py-1 ${current ? "border-fp-pink bg-fp-pink text-white" : "border-fp-border bg-white hover:border-fp-pink"}`}
              >
                {monthLabel(m)}
              </Link>
            );
          })}
        </nav>
      )}
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { inputClass, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatTitle, getChatOverview } from "@/lib/team-chat";

export const metadata: Metadata = { title: "Search" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

// Search the messages you can see (open channels and your own chats).
export default async function ChatSearch(props: PageProps<"/chat/search">) {
  await getCurrentUser();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const supabase = await createClient();
  const [{ data }, chats] = await Promise.all([
    q.length >= 2 ? supabase.rpc("search_team_chat", { p_query: q }) : Promise.resolve({ data: [] }),
    getChatOverview(),
  ]);
  const results = (data ?? []) as { id: string; channel_id: string; author_name: string | null; body: string; created_at: string }[];
  const where = (id: string) => {
    const c = chats.find((x) => x.id === id);
    return c ? (c.kind === "direct" ? chatTitle(c) : `#${c.name}`) : "a chat";
  };

  return (
    <div className="flex-1 overflow-y-auto bg-fp-offwhite px-4 py-5">
      <Link href="/chat" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline lg:hidden">
        <ChevronLeft size={14} aria-hidden /> All chats
      </Link>
      <form method="get" className="flex max-w-xl gap-2">
        <input name="q" defaultValue={q} minLength={2} maxLength={100} autoFocus placeholder="Search messages" aria-label="Search messages" className={inputClass} />
        <button type="submit" className={secondaryButton}>
          Search
        </button>
      </form>
      {q.length >= 2 && (
        <div className="mt-4 grid max-w-3xl gap-2">
          <p className="text-sm text-fp-mid">
            {results.length === 0 ? "No messages found." : `${results.length}${results.length === 50 ? "+" : ""} message${results.length === 1 ? "" : "s"}`}
          </p>
          {results.map((r) => (
            <Link key={r.id} href={`/chat/${r.channel_id}`} className="rounded-md bg-white p-3 text-sm ring-1 ring-fp-border hover:ring-fp-pink">
              <p className="text-xs text-fp-mid">
                <strong className="text-fp-black">{r.author_name ?? "Former member of staff"}</strong> in {where(r.channel_id)} · {when(r.created_at)}
              </p>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{r.body}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

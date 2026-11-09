import type { Metadata } from "next";
import Link from "next/link";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, Notice, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { shortDateTime } from "@/lib/customers/display";
import { createClient } from "@/lib/supabase/server";
import { setChatDealtWith } from "../../leads/actions";
import SupportTabs from "../SupportTabs";

export const metadata: Metadata = { title: "Website chat" };

type Conversation = {
  id: string;
  widget_id: string;
  status: "bot" | "handover" | "closed";
  name: string | null;
  email: string | null;
  phone: string | null;
  lead_id: string | null;
  page: string | null;
  started_at: string;
  last_at: string;
  handed_over_at: string | null;
};

const statusBadge = (c: Conversation) =>
  c.status === "closed" ? <Badge>Dealt with</Badge> : c.status === "handover" ? <Badge tone="pink">Needs a person</Badge> : <Badge tone="teal">Bot chatting</Badge>;

// Customer support → Website chat (owner, 9 November 2026): the chats from
// Footprint's websites. The Grok bot answers; chats it hands over need a
// person, who replies by email or phone and marks the chat as dealt with.
export default async function SupportChatPage(props: PageProps<"/support/chat">) {
  const user = await getCurrentUser();
  if (!user.can("support", "view") && !user.can("marketing", "view")) return <NoAccess title="Website chat" />;
  const canEdit = user.can("support", "edit") || user.can("marketing", "edit");
  const sp = await props.searchParams;
  const view = sp.view === "all" ? "all" : sp.view === "done" ? "done" : "open";
  const supabase = await createClient();
  const [{ data: widgetRows }, { data: convRows }] = await Promise.all([
    supabase.from("chat_widgets").select("id, name"),
    supabase.from("chat_conversations").select("id, widget_id, status, name, email, phone, lead_id, page, started_at, last_at, handed_over_at").order("last_at", { ascending: false }).limit(200),
  ]);
  const widgets = widgetRows ?? [];
  const convs = (convRows ?? []) as Conversation[];
  const shown = convs.filter((c) => (view === "all" ? true : view === "done" ? c.status === "closed" : c.status !== "closed"));
  const needPerson = convs.filter((c) => c.status === "handover").length;
  const selected = typeof sp.c === "string" ? convs.find((c) => c.id === sp.c) : undefined;
  const { data: messages } = selected
    ? await supabase.from("chat_messages").select("role, body, created_at").eq("conversation_id", selected.id).order("created_at")
    : { data: [] as { role: string; body: string; created_at: string }[] };
  const widgetName = (id: string) => widgets.find((w) => w.id === id)?.name ?? "—";

  return (
    <>
      <PageHeader title="Customer support" intro="Chats from Footprint's websites. The bot answers what it can; chats that need a person are marked, and the chosen people are emailed." />
      <SupportTabs current="chat" chatsNeedingPerson={needPerson} />
      <div className="grid max-w-5xl gap-5 px-4 py-6 sm:px-6 lg:px-10">
        <Notice searchParams={sp} />
        <Card title={`Chats${needPerson ? ` · ${needPerson} need a person` : ""}`}>
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            {(
              [
                ["open", "Open"],
                ["done", "Dealt with"],
                ["all", "All"],
              ] as const
            ).map(([k, label]) => (
              <Link key={k} href={`/support/chat?view=${k}`} className={`rounded-full border px-3 py-1 font-semibold ${view === k ? "border-fp-black bg-fp-black text-white" : "border-fp-border bg-white"}`}>
                {label}
              </Link>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-fp-mid">No chats here yet.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
              <ul className="grid content-start gap-1 text-sm">
                {shown.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/support/chat?view=${view}&c=${c.id}`}
                      scroll={false}
                      className={`block rounded-md border p-2 ${selected?.id === c.id ? "border-fp-pink bg-fp-pink/5" : "border-fp-border bg-white hover:border-fp-pink"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{c.name ?? "Visitor"}</span>
                        {statusBadge(c)}
                      </span>
                      <span className="block text-xs text-fp-mid">
                        {widgetName(c.widget_id)} · {shortDateTime(c.last_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div>
                {selected ? (
                  <div className="grid gap-3 rounded-md border border-fp-border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{selected.name ?? "Visitor"}</p>
                      {statusBadge(selected)}
                      {selected.lead_id && (
                        <Link href={`/leads?open=${selected.lead_id}`} className="text-xs font-semibold text-fp-teal-deep hover:underline">
                          Open the lead
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-fp-dark/75">
                      {[selected.email, selected.phone, widgetName(selected.widget_id), selected.page && `from ${selected.page}`].filter(Boolean).join(" · ")}
                      {" · started "}
                      {shortDateTime(selected.started_at)}
                    </p>
                    <div className="grid max-h-[28rem] gap-2 overflow-y-auto rounded-md bg-fp-offwhite p-3">
                      {(messages ?? []).map((m, i) =>
                        m.role === "system" ? (
                          <p key={i} className="text-center text-xs italic text-fp-mid">
                            {m.body}
                          </p>
                        ) : (
                          <div key={i} className={`flex ${m.role === "visitor" ? "justify-start" : "justify-end"}`}>
                            <p className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 ${m.role === "visitor" ? "border border-fp-border bg-white" : "bg-fp-light"}`}>
                              <span className="block text-[10px] font-semibold uppercase text-fp-mid">{m.role === "visitor" ? "Visitor" : "Bot"}</span>
                              {m.body}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                    {canEdit && (
                      <form action={setChatDealtWith.bind(null, selected.id, selected.status !== "closed")}>
                        <button type="submit" className={selected.status === "closed" ? secondaryButton : primaryButton}>
                          {selected.status === "closed" ? "Reopen" : "Mark as dealt with"}
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-fp-mid">Pick a chat to read it.</p>
                )}
              </div>
            </div>
          )}
        </Card>

        {user.can("marketing", "edit") && (
          <p className="text-sm">
            <Link href="/leads/chat" className="font-semibold text-fp-teal-deep hover:underline">
              Set up the chat boxes
            </Link>{" "}
            (greeting, what the bot knows, who is emailed, the website code).
          </p>
        )}
      </div>
    </>
  );
}

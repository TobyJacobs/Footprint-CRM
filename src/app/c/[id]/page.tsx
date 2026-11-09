import type { Metadata } from "next";
import { connection } from "next/server";
import { PUBLIC_ID_RE } from "@/lib/lead-forms";
import { createClient } from "@/lib/supabase/server";
import ChatBox from "./ChatBox";

export const metadata: Metadata = { title: { absolute: "Chat with us" }, robots: { index: false, follow: false } };

type PublicChat = { public_id: string; site_name: string; greeting: string; privacy_url: string | null };

// The website chat window, shown in a frame by the chat bubble on
// footprintgroup.uk and forgetmenotonline.org (public/chat-widget.js).
export default async function WebsiteChat(props: PageProps<"/c/[id]">) {
  await connection();
  const { id } = await props.params;
  const sp = await props.searchParams;
  let chat: PublicChat | null = null;
  if (PUBLIC_ID_RE.test(id)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("public_chat_widget", { p_public_id: id });
    chat = (data as PublicChat | null) ?? null;
  }
  const page = typeof sp.page === "string" ? sp.page.slice(0, 300) : "";
  return (
    <main className="h-dvh bg-white">
      {chat ? (
        <ChatBox publicId={chat.public_id} siteName={chat.site_name} greeting={chat.greeting} privacyUrl={chat.privacy_url} page={page} embed={sp.embed === "1"} />
      ) : (
        <p className="p-6 text-sm text-fp-dark/75">This chat is closed at the moment.</p>
      )}
    </main>
  );
}

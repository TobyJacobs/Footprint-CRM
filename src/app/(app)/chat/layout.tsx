import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getChatOverview } from "@/lib/team-chat";
import ChatList from "./ChatList";

export const metadata: Metadata = { title: { default: "Team chat", template: "%s · Team chat · FootprintOS" } };

// Team chat: the list of chats down the side, the open chat on the right.
// Every active member of staff can use it.
export default async function ChatLayout({ children }: LayoutProps<"/chat">) {
  const user = await getCurrentUser();
  const chats = await getChatOverview();
  return (
    <div className="flex h-[calc(100dvh-4.5rem)] min-h-0 lg:h-dvh">
      <ChatList chats={chats} userId={user.id} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

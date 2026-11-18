import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, Notice, inputClass, primaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getChatPeople } from "@/lib/team-chat";
import { createChannel, startDirectChat } from "../actions";

export const metadata: Metadata = { title: "New chat" };

// Message someone (or a few people), or start a channel.
export default async function NewChat(props: PageProps<"/chat/new">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const people = (await getChatPeople()).filter((p) => p.id !== user.id);
  const picker = (name: string) => (
    <div className="grid max-h-64 gap-1 overflow-y-auto rounded-md border border-fp-border p-2 sm:grid-cols-2">
      {people.map((p) => (
        <label key={p.id} className="flex items-center gap-2">
          <input type="checkbox" name={name} value={p.id} className="accent-fp-pink" /> {p.name}
        </label>
      ))}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-fp-offwhite px-4 py-5">
      <Link href="/chat" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline lg:hidden">
        <ChevronLeft size={14} aria-hidden /> All chats
      </Link>
      <div className="grid max-w-3xl gap-5">
        <Notice searchParams={sp} />
        <Card title="Message someone">
          <form action={startDirectChat} className="grid gap-3 text-sm">
            <p className="text-fp-mid">Tick one person, or a few for a group message. Only the people in it can read it.</p>
            {picker("people")}
            <div>
              <button type="submit" className={primaryButton}>
                Start chatting
              </button>
            </div>
          </form>
        </Card>
        <Card title="New channel">
          <form action={createChannel} className="grid gap-3 text-sm">
            <label className="grid gap-1">
              <span className="font-semibold">Name</span>
              <input name="name" required maxLength={60} placeholder="e.g. Sales team" className={inputClass} />
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">What it&apos;s for (optional)</span>
              <input name="topic" maxLength={300} className={inputClass} />
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="private" className="mt-0.5 accent-fp-pink" />
              <span>
                <strong>Private</strong>: only the people in it can find and read it (nobody else, including admins). Otherwise any member of staff can
                read and join it.
              </span>
            </label>
            <p className="font-semibold">Who to add now (you can add more later)</p>
            {picker("members")}
            <div>
              <button type="submit" className={primaryButton}>
                Create channel
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

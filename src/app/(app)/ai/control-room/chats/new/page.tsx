import type { Metadata } from "next";
import Link from "next/link";
import { Card, Field, Notice, inputClass, primaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { engineLabel, type BotEngine } from "@/lib/ai/bot-tools";
import { createClient } from "@/lib/supabase/server";
import { startChat } from "../../actions";
import { Pane } from "../../parts";

export const metadata: Metadata = { title: "New group chat · Control room" };

// Start a group chat: choose two or more bots and write the first message.
export default async function NewChatPage(props: PageProps<"/ai/control-room/chats/new">) {
  await requirePermission("ai", "view");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: bots } = await supabase.from("ai_bots").select("id, name, engine, description, webhook_url").eq("active", true).order("name");
  const usable = (bots ?? []).filter((b) => b.engine !== "outside" || b.webhook_url);
  return (
    <Pane>
      <Link href="/ai/control-room" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Control room
      </Link>
      <h2 className="text-2xl font-black">New group chat</h2>
      <Notice searchParams={sp} />
      <Card>
        <form action={startChat} className="grid gap-4">
          <Field label="Name">
            <input name="title" required maxLength={120} placeholder="e.g. New website brief for Riverside Bakery" className={inputClass} />
          </Field>
          <fieldset className="grid gap-2 text-sm">
            <legend className="mb-1 font-semibold">Bots in the chat (choose two or more)</legend>
            {usable.length < 2 && <p className="text-fp-mid">You need at least two bots switched on. Connect more under Bots.</p>}
            {usable.map((b) => (
              <label key={b.id} className="flex items-start gap-2">
                <input type="checkbox" name="bot_ids" value={b.id} className="mt-1" />
                <span>
                  <span className="font-semibold">{b.name}</span>{" "}
                  <span className="text-fp-mid">
                    · {engineLabel[b.engine as BotEngine]}
                    {b.description ? ` · ${b.description}` : ""}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <Field label="First message" hint="Set the scene: what you'd like them to work out together, and who should start.">
            <textarea name="body" rows={4} required maxLength={8000} className={inputClass} />
          </Field>
          <p className="text-xs text-fp-mid">Bots in a group chat only talk: they don&apos;t make quotes or send anything. Everyone in FootprintAI can read and join it.</p>
          <div>
            <button className={primaryButton}>Start the chat</button>
          </div>
        </form>
      </Card>
    </Pane>
  );
}

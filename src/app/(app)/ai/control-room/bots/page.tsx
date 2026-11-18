import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { engineLabel, type BotEngine } from "@/lib/ai/bot-tools";
import { createClient } from "@/lib/supabase/server";
import { saveBot } from "../actions";
import BotForm from "./BotForm";

export const metadata: Metadata = { title: "Bots · Control room" };

// The team's bots (admins): Claude and Grok bots run inside FootprintOS;
// outside bots connect in with a key.
export default async function BotsPage(props: PageProps<"/ai/control-room/bots">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: bots }, { data: agents }] = await Promise.all([
    supabase.from("ai_bots").select("id, name, engine, model, active").order("name"),
    supabase.from("ai_projects").select("id, title").order("title"),
  ]);
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/ai/control-room" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Control room
      </Link>
      <h2 className="text-2xl font-black">Bots</h2>
      <Notice searchParams={sp} />
      <Card title="The team's bots">
        <ul className="divide-y divide-fp-border">
          {(bots ?? []).map((b) => (
            <li key={b.id}>
              <Link href={`/ai/control-room/bots/${b.id}`} className="flex items-center gap-3 py-3 hover:bg-fp-offwhite">
                <span className="flex-1 font-semibold">{b.name}</span>
                <span className="text-xs text-fp-mid">
                  {engineLabel[b.engine as BotEngine]}
                  {b.model ? ` · ${b.model}` : ""}
                </span>
                {!b.active && <Badge>Switched off</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Add a bot">
        <BotForm action={saveBot.bind(null, null)} agents={agents ?? []} submitLabel="Add bot" />
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { engineLabel, type BotEngine } from "@/lib/ai/bot-tools";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { saveBot } from "../actions";
import BotForm from "./BotForm";

export const metadata: Metadata = { title: "Bots · Control room" };

// The team's bots. Everyone on the FootprintAI list can connect their own;
// each bot's owner (and admins) can change it.
export default async function BotsPage(props: PageProps<"/ai/control-room/bots">) {
  const user = await requirePermission("ai", "view");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: bots }, { data: agents }, { nameOf }] = await Promise.all([
    supabase.from("ai_bots").select("id, name, engine, model, active, owner_id, description, key_name").order("name"),
    supabase.from("ai_projects").select("id, title").order("title"),
    loadPeople(supabase),
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
              <Link href={`/ai/control-room/bots/${b.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-fp-offwhite">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{b.name}</span>
                  {b.description && <span className="block truncate text-xs text-fp-mid">{b.description}</span>}
                </span>
                <span className="text-xs text-fp-mid">
                  {engineLabel[b.engine as BotEngine]} · {b.owner_id ? (nameOf.get(b.owner_id) ?? "—") : "Footprint"}
                  {b.engine !== "outside" && (b.key_name ? ` · own key (${b.key_name})` : " · company key")}
                </span>
                {!b.active && <Badge>Switched off</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Connect your bot">
        <p className="mb-4 text-sm text-fp-mid">
          Add a bot you use, so everyone can ask it in the control room and bring it into group chats. A Claude or Grok bot runs here with your
          instructions. A bot that lives somewhere else connects with a key and, if it has one, its own web address.
        </p>
        <BotForm action={saveBot.bind(null, null)} agents={agents ?? []} submitLabel="Add bot" canQuote={user.can("quotes", "edit")} />
      </Card>
    </div>
  );
}

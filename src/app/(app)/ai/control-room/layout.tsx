import { requirePermission } from "@/lib/auth";
import { botReady } from "@/lib/ai/control-room";
import { createClient } from "@/lib/supabase/server";
import ControlRail, { type RailBot } from "./ControlRail";

// The control room's frame, laid out like Team chat: a dark panel down the
// side with the bots (and whether each is ready), group chats and recent
// runs; the work area on the right.
export default async function ControlRoomLayout({ children }: LayoutProps<"/ai/control-room">) {
  await requirePermission("ai", "view");
  const supabase = await createClient();
  const [{ data: bots }, { data: chats }, { data: runs }] = await Promise.all([
    supabase.from("ai_bots").select("id, name, engine, active, webhook_url, key_name, description").order("name"),
    supabase.from("ai_chats").select("id, title").order("updated_at", { ascending: false }).limit(12),
    supabase.from("ai_bot_runs").select("id, request, status, ai_bots(name)").order("created_at", { ascending: false }).limit(8),
  ]);
  const railBots: RailBot[] = (bots ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    engine: b.engine,
    description: b.description,
    state: !b.active ? "off" : (b.engine === "outside" ? !!b.webhook_url : botReady(b)) ? "ready" : "waiting",
  }));
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-fp-black shadow-2xl ring-1 ring-black/10 lg:h-[calc(100dvh-14rem)] lg:min-h-[600px] lg:flex-row">
      <ControlRail
        bots={railBots}
        chats={(chats ?? []).map((c) => ({ id: c.id, title: c.title }))}
        runs={(runs ?? []).map((r) => ({
          id: r.id,
          request: r.request,
          status: r.status,
          bot: (r.ai_bots as unknown as { name: string } | null)?.name ?? "Bot",
        }))}
      />
      <div className="flex min-h-[70dvh] min-w-0 flex-1 flex-col bg-fp-offwhite lg:min-h-0">{children}</div>
    </div>
  );
}

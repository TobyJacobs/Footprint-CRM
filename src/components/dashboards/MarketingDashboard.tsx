import { longDate } from "@/lib/customers/display";
import { isoDate } from "@/lib/dashboards/data";
import { campaignTimeUsed, contentStatusLabel, spendPace } from "@/lib/marketing/options";
import { isOpenProject } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { SimpleList, Tile, money } from "./parts";

// Marketing team: my tasks, content due this week, content waiting on
// clients, and ad campaigns that need a look.
export default async function MarketingDashboard({ userId }: { userId: string }) {
  const supabase = await createClient();
  const today = isoDate();
  const weekAhead = isoDate(7);
  const customerName = (c: unknown) => (c as { name: string } | null)?.name ?? "Footprint";

  const [{ data: myTasks }, { data: dueContent }, { data: awaiting, count: awaitingCount }, { data: campaigns }, { count: liveRetainers }] =
    await Promise.all([
      supabase
        .from("project_tasks")
        .select("id, title, due_date, projects(id, number, status, customers(name))")
        .eq("assignee_id", userId)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(200),
      supabase
        .from("content_items")
        .select("id, title, channel, status, publish_date, assignee_id, customers(name)")
        .neq("status", "published")
        .lte("publish_date", weekAhead)
        .order("publish_date")
        .limit(200),
      supabase
        .from("content_items")
        .select("id, title, channel, publish_date, customers(name)", { count: "exact" })
        .eq("status", "client_approval")
        .order("publish_date", { ascending: true, nullsFirst: false })
        .limit(8),
      supabase
        .from("ad_campaigns")
        .select("id, name, status, start_date, end_date, budget, spend, customers(name)")
        .eq("status", "live")
        .limit(500),
      supabase.from("retainers").select("id", { count: "exact", head: true }).eq("status", "Live"),
    ]);

  const tasks = (myTasks ?? []).filter((t) => isOpenProject((t.projects as unknown as { status: string } | null)?.status ?? ""));
  const lateTasks = tasks.filter((t) => t.due_date && t.due_date < today);
  const content = dueContent ?? [];
  const lateContent = content.filter((c) => c.publish_date && c.publish_date < today);
  const mineContent = content.filter((c) => c.assignee_id === userId);

  const flagged = (campaigns ?? [])
    .map((c) => {
      const spend = Number(c.spend);
      const budget = c.budget === null ? null : Number(c.budget);
      return { c, spend, budget, pace: spendPace(spend, budget, campaignTimeUsed(c.start_date, c.end_date, today)) };
    })
    .filter((x) => x.pace === "over" || x.pace === "ahead");
  const liveSpend = (campaigns ?? []).reduce((s, c) => s + Number(c.spend), 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="My open tasks"
          value={String(tasks.length)}
          note={lateTasks.length ? `${lateTasks.length} past their due date` : "None overdue"}
          tone={lateTasks.length ? "red" : undefined}
          href="/marketing"
        />
        <Tile
          label="Content due in 7 days"
          value={String(content.length)}
          note={lateContent.length ? `${lateContent.length} late · ${mineContent.length} yours` : `${mineContent.length} yours`}
          tone={lateContent.length ? "red" : undefined}
          href="/marketing/content?view=list"
        />
        <Tile
          label="Waiting for client approval"
          value={String(awaitingCount ?? 0)}
          note="Posts and blogs sent to clients"
          tone={awaitingCount ? "amber" : undefined}
          href="/marketing/content?view=list&status=client_approval"
        />
        <Tile
          label="Live ad campaigns"
          value={String(campaigns?.length ?? 0)}
          note={flagged.length ? `${flagged.length} need a look · ${money(liveSpend)} spent` : `${money(liveSpend)} spent · ${liveRetainers ?? 0} live retainers`}
          tone={flagged.length ? "red" : "teal"}
          href="/marketing/campaigns"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SimpleList
          title="My tasks, due soonest"
          empty="No open tasks assigned to you."
          action={{ href: "/projects?mine=1", label: "My projects" }}
          rows={tasks.slice(0, 8).map((t) => {
            const p = t.projects as unknown as { id: string; number: string; customers: { name: string } | null };
            return {
              key: t.id,
              href: `/projects/${p.id}`,
              primary: t.title,
              secondary: `${p.number} · ${customerName(p.customers)}`,
              right: t.due_date ? longDate(t.due_date) : "No date",
              tone: t.due_date && t.due_date < today ? "red" : t.due_date && t.due_date <= weekAhead ? "amber" : undefined,
            };
          })}
        />
        <SimpleList
          title="Content due this week"
          empty="Nothing due in the next 7 days."
          action={{ href: "/marketing/content", label: "Content calendar" }}
          rows={content.slice(0, 8).map((c) => ({
            key: c.id,
            href: `/marketing/content/${c.id}`,
            primary: c.title,
            secondary: `${c.channel} · ${customerName(c.customers)} · ${contentStatusLabel(c.status)}`,
            right: c.publish_date ? longDate(c.publish_date) : "",
            tone: c.publish_date && c.publish_date < today ? "red" : undefined,
          }))}
        />
        <SimpleList
          title="Waiting for client approval"
          empty="Nothing is waiting on a client."
          rows={(awaiting ?? []).map((c) => ({
            key: c.id,
            href: `/marketing/content/${c.id}`,
            primary: c.title,
            secondary: `${c.channel} · ${customerName(c.customers)}`,
            right: c.publish_date ? longDate(c.publish_date) : "No date",
            tone: "amber",
          }))}
        />
        <SimpleList
          title="Ad campaigns that need a look"
          empty="All live campaigns are on budget."
          action={{ href: "/marketing/campaigns", label: "All campaigns" }}
          rows={flagged.slice(0, 8).map(({ c, spend, budget, pace }) => ({
            key: c.id,
            href: `/marketing/campaigns/${c.id}`,
            primary: `${c.name} · ${customerName(c.customers)}`,
            secondary: pace === "over" ? "Over budget" : "Spending faster than planned",
            right: `${money(spend)} of ${budget !== null ? money(budget) : "—"}`,
            tone: "red",
          }))}
        />
      </div>
    </div>
  );
}

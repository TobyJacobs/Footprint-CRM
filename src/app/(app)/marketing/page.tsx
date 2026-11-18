import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Card, Notice, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { longDate } from "@/lib/customers/display";
import {
  campaignStatusLabel,
  contentServices,
  contentStatusLabel,
  contentTone,
  isMonth,
  monthBounds,
  monthLabel,
  shiftMonth,
} from "@/lib/marketing/options";
import { addDays, isOpenProject, minutesText, taskStatusLabel, todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";

type Service = { service: string; qty_per_month: number | null; platforms: string | null; ad_spend: number | null };

function Bar({ value, total, over }: { value: number; total: number; over?: boolean }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-fp-light">
      <div className={`h-full ${over ? "bg-fp-error" : "bg-fp-teal"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function MarketingOverview(props: PageProps<"/marketing">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const today = todayIso();
  const month = isMonth(sp.month) ? sp.month : today.slice(0, 7);
  const { first, last } = monthBounds(month);
  const mine = sp.mine === "1";
  const canEdit = user.can("marketing", "edit");
  const supabase = await createClient();

  // My work: open tasks assigned to me, and content I'm down to deliver soon.
  let retainerQuery = supabase
    .from("retainers")
    .select("id, name, budget_hours, digital_am_id, customers(id, name), retainer_services(service, qty_per_month, platforms, ad_spend)")
    .eq("status", "Live")
    .limit(500);
  if (mine) retainerQuery = retainerQuery.eq("digital_am_id", user.id);

  const [{ data: myTasks }, { data: myContent }, { data: retainers }, { data: people }] = await Promise.all([
    supabase
      .from("project_tasks")
      .select("id, title, status, due_date, stage, projects(id, number, name, status, customers(name))")
      .eq("assignee_id", user.id)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from("content_items")
      .select("id, title, channel, status, publish_date, customers(name)")
      .eq("assignee_id", user.id)
      .neq("status", "published")
      .or(`publish_date.is.null,publish_date.lte.${addDays(today, 14)}`)
      .order("publish_date", { ascending: true, nullsFirst: false })
      .limit(50),
    retainerQuery,
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const nameOf = new Map((people ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? (p.email as string)]));
  const tasks = (myTasks ?? []).filter((t) => {
    const project = t.projects as unknown as { status: string } | null;
    return project && isOpenProject(project.status);
  });

  // This month's figures for each retained client: content, hours and campaigns.
  const customerIds = [...new Set((retainers ?? []).map((r) => (r.customers as unknown as { id: string } | null)?.id).filter(Boolean))] as string[];
  const [{ data: monthContent }, { data: retainedProjects }, { data: liveCampaigns }] = customerIds.length
    ? await Promise.all([
        supabase.from("content_items").select("customer_id, status").in("customer_id", customerIds).gte("publish_date", first).lte("publish_date", last).limit(10000),
        supabase.from("projects").select("id, customer_id").in("customer_id", customerIds).eq("project_group", "Marketing Retained").limit(5000),
        supabase.from("ad_campaigns").select("customer_id, status").in("customer_id", customerIds).in("status", ["live", "paused"]),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const projectCustomer = new Map((retainedProjects ?? []).map((p) => [p.id as string, p.customer_id as string]));
  const { data: logs } = projectCustomer.size
    ? await supabase
        .from("time_logs")
        .select("project_id, minutes")
        .in("project_id", [...projectCustomer.keys()])
        .gte("log_date", first)
        .lte("log_date", last)
        .not("minutes", "is", null)
        .limit(20000)
    : { data: [] };

  const minutesBy = new Map<string, number>();
  for (const l of logs ?? []) {
    const c = projectCustomer.get(l.project_id as string);
    if (c) minutesBy.set(c, (minutesBy.get(c) ?? 0) + Number(l.minutes ?? 0));
  }
  const contentBy = new Map<string, { planned: number; ready: number }>();
  for (const c of monthContent ?? []) {
    const k = c.customer_id as string;
    const s = contentBy.get(k) ?? { planned: 0, ready: 0 };
    s.planned += 1;
    if (c.status === "scheduled" || c.status === "published") s.ready += 1;
    contentBy.set(k, s);
  }
  const campaignsBy = new Map<string, { live: number; paused: number }>();
  for (const c of liveCampaigns ?? []) {
    const k = c.customer_id as string;
    const s = campaignsBy.get(k) ?? { live: 0, paused: 0 };
    if (c.status === "live") s.live += 1;
    else s.paused += 1;
    campaignsBy.set(k, s);
  }

  const board = (retainers ?? [])
    .map((r) => {
      const customer = r.customers as unknown as { id: string; name: string } | null;
      const services = (r.retainer_services as unknown as Service[]) ?? [];
      const target = services
        .filter((s) => (contentServices as readonly string[]).includes(s.service))
        .reduce((sum, s) => sum + (s.qty_per_month ?? 0), 0);
      const content = (customer && contentBy.get(customer.id)) || { planned: 0, ready: 0 };
      const minutes = (customer && minutesBy.get(customer.id)) || 0;
      const budgetMinutes = (r.budget_hours ?? 0) * 60;
      return { r, customer, services, target, content, minutes, budgetMinutes, campaigns: (customer && campaignsBy.get(customer.id)) || { live: 0, paused: 0 } };
    })
    .sort((a, b) => (a.customer?.name ?? "").localeCompare(b.customer?.name ?? ""));

  const monthLink = (m: string) => `/marketing?month=${m}${mine ? "&mine=1" : ""}`;

  return (
    <div className="grid gap-8">
      <Notice searchParams={sp} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title={`My tasks (${tasks.length})`}
          action={
            <Link href="/projects?mine=1" className="text-sm font-semibold text-fp-teal-deep hover:underline">
              My projects
            </Link>
          }
        >
          {tasks.length === 0 ? (
            <p className="text-sm text-fp-mid">No open tasks assigned to you.</p>
          ) : (
            <ul className="divide-y divide-fp-border">
              {tasks.slice(0, 15).map((t) => {
                const project = t.projects as unknown as { id: string; number: string; name: string; customers: { name: string } | null };
                const late = t.due_date && t.due_date < today;
                return (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <Link href={`/projects/${project.id}`} className="font-semibold hover:text-fp-pink">
                        {t.title}
                      </Link>
                      <p className="truncate text-xs text-fp-mid">
                        {project.number} · {project.customers?.name ?? project.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {t.due_date && <p className={`text-xs ${late ? "font-semibold text-fp-error" : "text-fp-mid"}`}>{longDate(t.due_date)}</p>}
                      {t.status === "in_progress" && <Badge tone="pink">{taskStatusLabel(t.status)}</Badge>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title={`My content, next 2 weeks (${myContent?.length ?? 0})`}
          action={
            canEdit ? (
              <Link href="/marketing/content/new?back=/marketing" className="text-sm font-semibold text-fp-teal-deep hover:underline">
                Add content
              </Link>
            ) : undefined
          }
        >
          {!myContent?.length ? (
            <p className="text-sm text-fp-mid">Nothing due. Content assigned to you appears here until it&apos;s published.</p>
          ) : (
            <ul className="divide-y divide-fp-border">
              {myContent.map((c) => {
                const customer = c.customers as unknown as { name: string } | null;
                const late = c.publish_date && c.publish_date < today;
                return (
                  <li key={c.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <Link href={`/marketing/content/${c.id}`} className="font-semibold hover:text-fp-pink">
                        {c.title}
                      </Link>
                      <p className="truncate text-xs text-fp-mid">
                        {c.channel} · {customer?.name ?? "Footprint"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-xs ${late ? "font-semibold text-fp-error" : "text-fp-mid"}`}>{c.publish_date ? longDate(c.publish_date) : "No date"}</p>
                      <Badge tone={contentTone(c.status)}>{contentStatusLabel(c.status)}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black">
            Retainers · {monthLabel(month)} <span className="font-normal text-fp-mid">({board.length} live)</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={monthLink(shiftMonth(month, -1))} className={secondaryButton} aria-label="Previous month">
              ←
            </Link>
            <Link href={monthLink(today.slice(0, 7))} className={secondaryButton}>
              This month
            </Link>
            <Link href={monthLink(shiftMonth(month, 1))} className={secondaryButton} aria-label="Next month">
              →
            </Link>
            <Link href={`/marketing?month=${month}${mine ? "" : "&mine=1"}`} className={mine ? primaryButton : secondaryButton}>
              {mine ? "Only mine ✓" : "Only mine"}
            </Link>
          </div>
        </div>

        {board.length === 0 ? (
          <p className="rounded-lg border border-dashed border-fp-border bg-white p-6 text-sm text-fp-mid">
            {mine ? "You're not the digital account manager on any live retainer." : "No live digital retainers. Retainers are added on each customer's page."}
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {board.map(({ r, customer, services, target, content, minutes, budgetMinutes, campaigns }) => {
              const overHours = budgetMinutes > 0 && minutes > budgetMinutes;
              return (
                <li key={r.id} className="grid gap-3 rounded-lg border border-fp-border bg-white p-4">
                  <div>
                    {customer ? (
                      <Link href={`/customers/${customer.id}`} className="font-bold hover:text-fp-pink">
                        {customer.name}
                      </Link>
                    ) : (
                      <span className="font-bold">{r.name}</span>
                    )}
                    <p className="text-xs text-fp-mid">
                      {r.name} · {r.digital_am_id ? nameOf.get(r.digital_am_id) ?? "Unknown" : "No account manager"}
                    </p>
                  </div>

                  {services.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {services.map((s, i) => (
                        <li key={i} className="rounded-full bg-fp-light px-2 py-0.5 text-xs">
                          {s.service}
                          {s.qty_per_month ? ` × ${s.qty_per_month}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="grid gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold">Content ready</span>
                      <span className="text-fp-mid">
                        {content.ready} of {target || content.planned} {target ? "due" : "planned"}
                        {target > 0 && content.planned < target ? ` · ${target - content.planned} not planned yet` : ""}
                      </span>
                    </div>
                    <Bar value={content.ready} total={target || content.planned} />
                  </div>

                  <div className="grid gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold">Hours</span>
                      <span className={overHours ? "font-semibold text-fp-error" : "text-fp-mid"}>
                        {minutesText(minutes)} of {budgetMinutes ? minutesText(budgetMinutes) : "no budget"}
                      </span>
                    </div>
                    <Bar value={minutes} total={budgetMinutes} over={overHours} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-fp-mid">
                      {campaigns.live + campaigns.paused === 0
                        ? "No ad campaigns running"
                        : `${campaigns.live} ${campaignStatusLabel("live").toLowerCase()}${campaigns.paused ? `, ${campaigns.paused} paused` : ""} ad campaign${campaigns.live + campaigns.paused === 1 ? "" : "s"}`}
                    </span>
                    {customer && (
                      <Link href={`/marketing/content?month=${month}&customer=${customer.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                        Content →
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-fp-mid">
          Hours come from time logged this month on the client&apos;s &ldquo;Marketing Retained&rdquo; projects. Content counts posts, blogs and emails dated this month.
        </p>
      </section>

      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <Link href="/projects/new" className={`${primaryButton} inline-flex items-center gap-2`}>
            <Plus size={16} aria-hidden /> New marketing job
          </Link>
          <Link href="/marketing/campaigns/new" className={secondaryButton}>
            New ad campaign
          </Link>
        </div>
      )}
    </div>
  );
}

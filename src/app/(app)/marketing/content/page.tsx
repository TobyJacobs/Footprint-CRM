import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { longDate } from "@/lib/customers/display";
import {
  contentChannels,
  contentStatusLabel,
  contentStatuses,
  contentTone,
  isMonth,
  monthBounds,
  monthLabel,
  shiftMonth,
} from "@/lib/marketing/options";
import { addDays, todayIso, weekStart } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { setContentStatus } from "../actions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const chipTones: Record<string, string> = {
  grey: "border-fp-border bg-fp-light",
  teal: "border-fp-teal/40 bg-fp-teal/15",
  pink: "border-fp-pink/30 bg-fp-pink/10",
  amber: "border-fp-amber/40 bg-fp-amber/20",
  red: "border-fp-error/30 bg-fp-error/10",
};

export default async function ContentCalendarPage(props: PageProps<"/marketing/content">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const today = todayIso();
  const month = isMonth(sp.month) ? sp.month : today.slice(0, 7);
  const view = sp.view === "list" ? "list" : "month";
  const channel = typeof sp.channel === "string" && (contentChannels as readonly string[]).includes(sp.channel) ? sp.channel : "";
  const status = typeof sp.status === "string" && contentStatuses.some((s) => s.value === sp.status) ? sp.status : "";
  const customerId = typeof sp.customer === "string" && /^[0-9a-f-]{36}$/i.test(sp.customer) ? sp.customer : "";
  const mine = sp.mine === "1";
  const canEdit = user.can("marketing", "edit");
  const { first, last } = monthBounds(month);
  const supabase = await createClient();

  let query = supabase
    .from("content_items")
    .select("id, title, channel, status, publish_date, assignee_id, customers(id, name)")
    .gte("publish_date", first)
    .lte("publish_date", last)
    .order("publish_date")
    .order("created_at")
    .limit(2000);
  let undatedQuery = supabase
    .from("content_items")
    .select("id, title, channel, status, publish_date, assignee_id, customers(id, name)")
    .is("publish_date", null)
    .neq("status", "published")
    .order("created_at", { ascending: false })
    .limit(200);
  if (channel) {
    query = query.eq("channel", channel);
    undatedQuery = undatedQuery.eq("channel", channel);
  }
  if (status) {
    query = query.eq("status", status);
    undatedQuery = undatedQuery.eq("status", status);
  }
  if (customerId) {
    query = query.eq("customer_id", customerId);
    undatedQuery = undatedQuery.eq("customer_id", customerId);
  }
  if (mine) {
    query = query.eq("assignee_id", user.id);
    undatedQuery = undatedQuery.eq("assignee_id", user.id);
  }

  const [{ data: items }, { data: undated }, { data: people }, { data: filterCustomer }] = await Promise.all([
    query,
    undatedQuery,
    supabase.from("profiles").select("id, full_name, email"),
    customerId ? supabase.from("customers").select("id, name").eq("id", customerId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? (p.email as string)]));

  // Keep the current filters when moving between months and views.
  const params = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const all = { month, view, channel, status, customer: customerId, mine: mine ? "1" : "", ...over };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return `/marketing/content?${p.toString()}`;
  };
  const here = params({});

  const byDate = new Map<string, NonNullable<typeof items>>();
  for (const it of items ?? []) {
    const list = byDate.get(it.publish_date as string) ?? [];
    list.push(it);
    byDate.set(it.publish_date as string, list);
  }

  // Calendar grid: whole weeks, Monday first, covering the month.
  const gridStart = weekStart(first);
  const gridEnd = addDays(weekStart(last), 6);
  const days: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const counts = contentStatuses.map((s) => ({ ...s, n: (items ?? []).filter((i) => i.status === s.value).length }));

  return (
    <div className="grid gap-6">
      <Notice searchParams={sp} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={params({ month: shiftMonth(month, -1) })} className={secondaryButton} aria-label="Previous month">
            ←
          </Link>
          <h2 className="min-w-44 text-center text-lg font-black">{monthLabel(month)}</h2>
          <Link href={params({ month: shiftMonth(month, 1) })} className={secondaryButton} aria-label="Next month">
            →
          </Link>
          <Link href={params({ month: today.slice(0, 7) })} className={secondaryButton}>
            Today
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={params({ view: "month" })} className={view === "month" ? primaryButton : secondaryButton}>
            Month
          </Link>
          <Link href={params({ view: "list" })} className={view === "list" ? primaryButton : secondaryButton}>
            List
          </Link>
          {canEdit && (
            <Link href={`/marketing/content/new?back=${encodeURIComponent(here)}${customerId ? `&customer=${customerId}` : ""}`} className={`${primaryButton} inline-flex items-center gap-2`}>
              <Plus size={16} aria-hidden /> Add content
            </Link>
          )}
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-fp-border bg-white p-4 text-sm">
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="view" value={view} />
        {customerId && <input type="hidden" name="customer" value={customerId} />}
        <label className="grid gap-1">
          <span className="font-semibold">Channel</span>
          <select name="channel" defaultValue={channel} className={inputClass}>
            <option value="">All channels</option>
            {contentChannels.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Status</span>
          <select name="status" defaultValue={status} className={inputClass}>
            <option value="">All statuses</option>
            {contentStatuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="accent-fp-pink" />
          Only mine
        </label>
        <button type="submit" className={secondaryButton}>
          Filter
        </button>
        {filterCustomer && (
          <span className="flex items-center gap-2 pb-2">
            Client: <strong>{filterCustomer.name}</strong>
            <Link href={params({ customer: "" })} className="text-fp-teal-deep hover:underline">
              show all clients
            </Link>
          </span>
        )}
      </form>

      <ul className="flex flex-wrap gap-2 text-xs">
        {counts.map((c) => (
          <li key={c.value}>
            <Badge tone={contentTone(c.value)}>
              {c.label}: {c.n}
            </Badge>
          </li>
        ))}
      </ul>

      {view === "month" ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7 overflow-hidden rounded-lg border border-fp-border bg-fp-border gap-px">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-fp-offwhite px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-fp-mid">
                {d}
              </div>
            ))}
            {days.map((d) => {
              const inMonth = d.startsWith(month);
              const list = byDate.get(d) ?? [];
              return (
                <div key={d} className={`min-h-28 p-1.5 ${inMonth ? "bg-white" : "bg-fp-offwhite"}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        d === today ? "rounded-full bg-fp-pink px-1.5 text-white" : inMonth ? "text-fp-dark" : "text-fp-mid"
                      }`}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {canEdit && inMonth && (
                      <Link
                        href={`/marketing/content/new?date=${d}&back=${encodeURIComponent(here)}${customerId ? `&customer=${customerId}` : ""}`}
                        className="text-xs text-fp-mid hover:text-fp-pink"
                        aria-label={`Add content on ${longDate(d)}`}
                      >
                        +
                      </Link>
                    )}
                  </div>
                  <ul className="grid gap-1">
                    {list.map((it) => {
                      const customer = it.customers as unknown as { name: string } | null;
                      return (
                        <li key={it.id}>
                          <Link
                            href={`/marketing/content/${it.id}`}
                            className={`block rounded border px-1.5 py-1 text-[11px] leading-tight hover:border-fp-pink ${chipTones[contentTone(it.status)]}`}
                            title={`${it.title} · ${contentStatusLabel(it.status)}`}
                          >
                            <span className="block truncate font-semibold">{it.title}</span>
                            <span className="block truncate text-fp-dark/70">
                              {it.channel} · {customer?.name ?? "Footprint"}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ContentTable items={items ?? []} nameOf={nameOf} canEdit={canEdit} back={here} today={today} />
      )}

      {(undated?.length ?? 0) > 0 && (
        <section>
          <h3 className="mb-3 font-bold">No date yet ({undated!.length})</h3>
          <ContentTable items={undated ?? []} nameOf={nameOf} canEdit={canEdit} back={here} today={today} />
        </section>
      )}
    </div>
  );
}

type Row = {
  id: string;
  title: string;
  channel: string;
  status: string;
  publish_date: string | null;
  assignee_id: string | null;
  customers: unknown;
};

function ContentTable({ items, nameOf, canEdit, back, today }: { items: Row[]; nameOf: Map<string, string>; canEdit: boolean; back: string; today: string }) {
  if (items.length === 0) {
    return <p className="rounded-lg border border-dashed border-fp-border bg-white p-6 text-sm text-fp-mid">Nothing planned for these filters.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-fp-border bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-fp-offwhite text-left text-xs uppercase tracking-wide text-fp-mid">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Content</th>
            <th className="px-4 py-2">Client</th>
            <th className="px-4 py-2">Channel</th>
            <th className="px-4 py-2">Who</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const customer = it.customers as { id: string; name: string } | null;
            const late = it.publish_date && it.publish_date < today && it.status !== "published";
            return (
              <tr key={it.id} className="border-b border-fp-border last:border-0 hover:bg-fp-offwhite">
                <td className={`whitespace-nowrap px-4 py-2 ${late ? "font-semibold text-fp-error" : ""}`}>{it.publish_date ? longDate(it.publish_date) : "—"}</td>
                <td className="px-4 py-2">
                  <Link href={`/marketing/content/${it.id}`} className="font-semibold hover:text-fp-pink">
                    {it.title}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {customer ? (
                    <Link href={`/customers/${customer.id}`} className="hover:text-fp-pink">
                      {customer.name}
                    </Link>
                  ) : (
                    "Footprint"
                  )}
                </td>
                <td className="px-4 py-2">{it.channel}</td>
                <td className="px-4 py-2">{it.assignee_id ? nameOf.get(it.assignee_id) ?? "—" : "—"}</td>
                <td className="px-4 py-2">
                  {canEdit ? (
                    <form action={setContentStatus.bind(null, it.id)} className="flex items-center gap-2">
                      <input type="hidden" name="back" value={back} />
                      <select name="status" defaultValue={it.status} className="rounded-md border border-fp-border bg-white px-2 py-1 text-xs" aria-label="Status">
                        {contentStatuses.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="text-xs font-semibold text-fp-teal-deep hover:underline">
                        Save
                      </button>
                    </form>
                  ) : (
                    <Badge tone={contentTone(it.status)}>{contentStatusLabel(it.status)}</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

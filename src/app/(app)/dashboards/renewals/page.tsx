import Link from "next/link";
import { Tile, money } from "@/components/dashboards/parts";
import { Badge, Card } from "@/components/ui";
import { longDate } from "@/lib/customers/display";
import { ukMonth } from "@/lib/dates";
import { addDays, todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { requireTab } from "../guard";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STEP: Record<string, number> = { monthly: 1, quarterly: 3, six_monthly: 6, annually: 12 };
const FREQ_LABEL: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", six_monthly: "Every 6 months", annually: "Yearly" };

function addMonths(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

const customerOf = (c: unknown) => c as { id: string; name: string } | null;

export default async function RenewalsDashboard() {
  await requireTab("renewals");
  const today = todayIso();
  const in30 = addDays(today, 30);
  const in60 = addDays(today, 60);
  const in90 = addDays(today, 90);
  const ago90 = `${addDays(today, -90)}T00:00:00`;
  const supabase = await createClient();

  const [{ data: recurring }, { data: hosting }, { data: retainers }, { data: endedRecurring }] = await Promise.all([
    supabase
      .from("recurring_invoices")
      .select("id, name, frequency, next_date, end_date, status, subtotal, customers(id, name)")
      .eq("status", "active")
      .order("next_date")
      .limit(2000),
    supabase.from("hosting_plans").select("id, name, plan_type, status, price, billing_frequency, renewal_month, updated_at, customers(id, name)").limit(5000),
    supabase.from("retainers").select("id, name, status, monthly_fee, updated_at, customers(id, name)").limit(5000),
    supabase
      .from("recurring_invoices")
      .select("id, name, status, subtotal, updated_at, customers(id, name)")
      .in("status", ["ended", "paused"])
      .gte("updated_at", ago90)
      .limit(500),
  ]);

  // Recurring invoices: every bill expected in the next 90 days, from each
  // schedule's next date and frequency (stopping at its end date).
  const buckets = { d30: 0, d60: 0, d90: 0 };
  const upcoming: { id: string; name: string; customer: { id: string; name: string } | null; date: string; value: number; frequency: string }[] = [];
  const ending: typeof upcoming = [];
  for (const r of recurring ?? []) {
    const value = Number(r.subtotal);
    const step = STEP[r.frequency] ?? 1;
    let date = r.next_date as string;
    let first = true;
    while (date <= in90 && (!r.end_date || date <= r.end_date)) {
      if (date >= today) {
        if (date <= in30) buckets.d30 += value;
        else if (date <= in60) buckets.d60 += value;
        else buckets.d90 += value;
        if (first) upcoming.push({ id: r.id, name: r.name, customer: customerOf(r.customers), date, value, frequency: r.frequency });
        first = false;
      }
      date = addMonths(date, step);
    }
    if (r.end_date && r.end_date >= today && r.end_date <= in90) {
      ending.push({ id: r.id, name: r.name, customer: customerOf(r.customers), date: r.end_date, value, frequency: r.frequency });
    }
  }

  // Hosting plans renew in a named month (domain / SSL renewal), no day.
  const thisMonth = Number(ukMonth().slice(5, 7)) - 1;
  const nextThree = [0, 1, 2].map((i) => MONTHS[(thisMonth + i) % 12]);
  const activeHosting = (hosting ?? []).filter((h) => (h.status ?? "").toLowerCase() !== "cancelled");
  const hostingByMonth = nextThree.map((month) => ({
    month,
    plans: activeHosting.filter((h) => (h.renewal_month ?? "").toLowerCase() === month.toLowerCase()),
  }));

  const liveRetainers = (retainers ?? []).filter((r) => r.status === "Live");
  const pausedRetainers = (retainers ?? []).filter((r) => r.status === "Paused");
  const retainerMonthly = liveRetainers.reduce((s, r) => s + Number(r.monthly_fee ?? 0), 0);

  const cancelled = [
    ...(hosting ?? [])
      .filter((h) => (h.status ?? "").toLowerCase() === "cancelled" && h.updated_at >= ago90)
      .map((h) => ({ key: `h-${h.id}`, kind: "Hosting plan", name: h.name, customer: customerOf(h.customers), when: h.updated_at as string })),
    ...(retainers ?? [])
      .filter((r) => r.status === "Cancelled" && r.updated_at >= ago90)
      .map((r) => ({ key: `r-${r.id}`, kind: "Retainer", name: r.name, customer: customerOf(r.customers), when: r.updated_at as string })),
    ...(endedRecurring ?? []).map((r) => ({
      key: `i-${r.id}`,
      kind: r.status === "paused" ? "Recurring invoice (paused)" : "Recurring invoice (ended)",
      name: r.name,
      customer: customerOf(r.customers),
      when: r.updated_at as string,
    })),
  ].sort((a, b) => b.when.localeCompare(a.when));

  return (
    <div className="grid gap-6">
      <p className="text-sm text-fp-dark/75">Recurring billing excludes VAT. Hosting plans renew in a month rather than on a date.</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Billing in the next 30 days" value={money(buckets.d30)} note="From recurring invoices" tone="teal" href="/sales/recurring" />
        <Tile label="Days 31–90" value={money(buckets.d60 + buckets.d90)} note={`${money(buckets.d60)} in 31–60 · ${money(buckets.d90)} in 61–90`} />
        <Tile label="Live retainers" value={String(liveRetainers.length)} note={`${money(retainerMonthly)} a month${pausedRetainers.length ? ` · ${pausedRetainers.length} paused` : ""}`} />
        <Tile
          label="Cancelled in last 90 days"
          value={String(cancelled.length)}
          note="Hosting, retainers and recurring invoices"
          tone={cancelled.length ? "red" : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Next recurring invoices (90 days)">
          {upcoming.length === 0 ? (
            <p className="text-sm text-fp-mid">No recurring invoices due in the next 90 days.</p>
          ) : (
            <ul className="divide-y divide-fp-border text-sm">
              {upcoming.slice(0, 15).map((u) => (
                <li key={u.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/sales/recurring/${u.id}`} className="font-semibold hover:text-fp-pink">
                      {u.name}
                    </Link>
                    <p className="truncate text-xs text-fp-mid">
                      {u.customer?.name ?? "—"} · {FREQ_LABEL[u.frequency] ?? u.frequency}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{money(u.value)}</p>
                    <p className={`text-xs ${u.date <= in30 ? "text-fp-teal-deep" : "text-fp-mid"}`}>{longDate(u.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {upcoming.length > 15 && <p className="mt-2 text-xs text-fp-mid">And {upcoming.length - 15} more.</p>}
        </Card>

        <Card title="Hosting renewals (domain and SSL)">
          <div className="grid gap-4">
            {hostingByMonth.map(({ month, plans }, i) => (
              <section key={month}>
                <h3 className="mb-1 text-sm font-bold">
                  {month} {i === 0 && <span className="font-normal text-fp-mid">(this month)</span>}{" "}
                  <span className="font-normal text-fp-mid">· {plans.length}</span>
                </h3>
                {plans.length === 0 ? (
                  <p className="text-xs text-fp-mid">None.</p>
                ) : (
                  <ul className="grid gap-1 text-sm">
                    {plans.slice(0, 10).map((h) => {
                      const c = customerOf(h.customers);
                      return (
                        <li key={h.id} className="flex justify-between gap-3">
                          <span className="min-w-0 truncate">
                            {c ? (
                              <Link href={`/customers/${c.id}`} className="hover:text-fp-pink">
                                {c.name}
                              </Link>
                            ) : (
                              h.name
                            )}
                            <span className="text-xs text-fp-mid"> · {h.plan_type ?? h.name}</span>
                          </span>
                          <span className="shrink-0 text-xs text-fp-mid">
                            {h.price ? `${money(Number(h.price))} ${h.billing_frequency ?? ""}` : ""}
                          </span>
                        </li>
                      );
                    })}
                    {plans.length > 10 && <li className="text-xs text-fp-mid">And {plans.length - 10} more.</li>}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Recurring invoices ending soon">
          {ending.length === 0 ? (
            <p className="text-sm text-fp-mid">No recurring invoices end in the next 90 days.</p>
          ) : (
            <ul className="divide-y divide-fp-border text-sm">
              {ending.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 py-2">
                  <Link href={`/sales/recurring/${e.id}`} className="hover:text-fp-pink">
                    {e.name} <span className="text-xs text-fp-mid">· {e.customer?.name ?? "—"}</span>
                  </Link>
                  <span className="shrink-0 text-xs font-semibold text-fp-orange">Ends {longDate(e.date)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-fp-mid">Worth a call before they end: a chance to renew.</p>
        </Card>

        <Card title="Cancelled or stopped in the last 90 days">
          {cancelled.length === 0 ? (
            <p className="text-sm text-fp-mid">Nothing cancelled recently.</p>
          ) : (
            <ul className="divide-y divide-fp-border text-sm">
              {cancelled.slice(0, 15).map((c) => (
                <li key={c.key} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    {c.customer ? (
                      <Link href={`/customers/${c.customer.id}`} className="font-semibold hover:text-fp-pink">
                        {c.customer.name}
                      </Link>
                    ) : (
                      <span className="font-semibold">{c.name}</span>
                    )}
                    <p className="truncate text-xs text-fp-mid">{c.name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone="red">{c.kind}</Badge>
                    <p className="mt-0.5 text-xs text-fp-mid">{longDate(c.when)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-fp-mid">Dated by when the record was last changed.</p>
        </Card>
      </div>
    </div>
  );
}

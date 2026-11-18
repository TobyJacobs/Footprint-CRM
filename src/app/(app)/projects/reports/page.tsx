import type { Metadata } from "next";
import Link from "next/link";
import { Card, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { addDays, isDateIso, minutesText, todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Time reports" };

// Time by project and by person for a date range.
export default async function TimeReportsPage(props: PageProps<"/projects/reports">) {
  await requirePermission("projects", "view");
  const sp = await props.searchParams;
  const today = todayIso();
  const from = isDateIso(sp.from) ? sp.from : `${today.slice(0, 8)}01`;
  const to = isDateIso(sp.to) ? sp.to : today;

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("time_logs")
    .select("minutes, billable, project_id, user_id, projects(number, name, customers(name)), user:user_id(full_name, email)")
    .not("minutes", "is", null)
    .gte("log_date", from)
    .lte("log_date", to)
    .limit(10000);

  type Row = { name: string; sub?: string; minutes: number; billable: number; entries: number };
  const byProject = new Map<string, Row>();
  const byPerson = new Map<string, Row>();
  let total = 0;
  let billable = 0;
  for (const l of logs ?? []) {
    const m = Number(l.minutes);
    total += m;
    if (l.billable) billable += m;
    const project = l.projects as unknown as { number: string; name: string; customers: { name: string } | null } | null;
    const person = l.user as unknown as { full_name: string | null; email: string } | null;
    const p = byProject.get(l.project_id) ?? { name: project ? `${project.number} ${project.name}` : "Project", sub: project?.customers?.name ?? "Internal", minutes: 0, billable: 0, entries: 0 };
    p.minutes += m;
    if (l.billable) p.billable += m;
    p.entries += 1;
    byProject.set(l.project_id, p);
    const u = byPerson.get(l.user_id) ?? { name: person ? (person.full_name ?? person.email) : "Someone", minutes: 0, billable: 0, entries: 0 };
    u.minutes += m;
    if (l.billable) u.billable += m;
    u.entries += 1;
    byPerson.set(l.user_id, u);
  }
  const sorted = (m: Map<string, Row>) => [...m.entries()].sort((a, b) => b[1].minutes - a[1].minutes);

  const table = (title: string, rows: [string, Row][], byProjectTable: boolean) => (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-fp-dark/70">No time logged in this period.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="py-2 pr-3 font-semibold">{byProjectTable ? "Project" : "Person"}</th>
              {byProjectTable && <th className="py-2 pr-3 font-semibold">Customer</th>}
              <th className="py-2 pr-3 text-right font-semibold">Billable</th>
              <th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, r]) => (
              <tr key={id} className="border-b border-fp-border last:border-0">
                <td className="py-2 pr-3 font-semibold">
                  {byProjectTable ? (
                    <Link href={`/projects/${id}`} className="hover:text-fp-pink">
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </td>
                {byProjectTable && <td className="py-2 pr-3">{r.sub}</td>}
                <td className="py-2 pr-3 text-right">{minutesText(r.billable)}</td>
                <td className="py-2 text-right font-semibold">{minutesText(r.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );

  return (
    <>
      <form className="mb-6 flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1">
          <span className="font-semibold">From</span>
          <input type="date" name="from" defaultValue={from} className="rounded-md border border-fp-border bg-white px-3 py-2" />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">To</span>
          <input type="date" name="to" defaultValue={to} className="rounded-md border border-fp-border bg-white px-3 py-2" />
        </label>
        <button type="submit" className={secondaryButton}>
          Show
        </button>
        <Link href={`/projects/reports?from=${addDays(today, -6)}&to=${today}`} className="pb-2 font-semibold text-fp-teal-deep hover:underline">
          Last 7 days
        </Link>
        <Link href="/projects/reports" className="pb-2 font-semibold text-fp-teal-deep hover:underline">
          This month
        </Link>
      </form>
      <p className="mb-4 text-sm">
        <strong>{minutesText(total)}</strong> logged in this period, <strong>{minutesText(billable)}</strong> billable.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {table("Time by project", sorted(byProject), true)}
        {table("Time by person", sorted(byPerson), false)}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { addDays, hoursText, isDateIso, todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Time reports" };

// Hours by project and by person for a date range. Managers only (the
// database only returns other people's time to managers anyway).
export default async function TimeReportsPage(props: PageProps<"/projects/reports">) {
  await requirePermission("projects", "view");
  const supabase = await createClient();
  const { data: manager } = await supabase.rpc("is_projects_manager");
  if (manager !== true) redirect("/projects?error=Time+reports+are+for+managers");

  const sp = await props.searchParams;
  const today = todayIso();
  const from = isDateIso(sp.from) ? sp.from : `${today.slice(0, 8)}01`;
  const to = isDateIso(sp.to) ? sp.to : today;

  const { data: entries } = await supabase
    .from("time_entries")
    .select("hours, project_id, user_id, projects(name, customers(name)), user:user_id(full_name, email)")
    .gte("work_date", from)
    .lte("work_date", to)
    .limit(10000);

  type Row = { name: string; sub?: string; hours: number; entries: number };
  const byProject = new Map<string, Row>();
  const byPerson = new Map<string, Row>();
  let total = 0;
  for (const e of entries ?? []) {
    const h = Number(e.hours);
    total += h;
    const project = e.projects as unknown as { name: string; customers: { name: string } | null } | null;
    const person = e.user as unknown as { full_name: string | null; email: string } | null;
    const p = byProject.get(e.project_id) ?? { name: project?.name ?? "Project", sub: project?.customers?.name ?? "Internal", hours: 0, entries: 0 };
    p.hours += h;
    p.entries += 1;
    byProject.set(e.project_id, p);
    const u = byPerson.get(e.user_id) ?? { name: person ? (person.full_name ?? person.email) : "Someone", hours: 0, entries: 0 };
    u.hours += h;
    u.entries += 1;
    byPerson.set(e.user_id, u);
  }
  const sorted = (m: Map<string, Row>) => [...m.entries()].sort((a, b) => b[1].hours - a[1].hours);

  const table = (title: string, rows: [string, Row][], showSub: boolean, href?: (id: string) => string) => (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-fp-dark/70">No time logged in this period.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="py-2 pr-3 font-semibold">{showSub ? "Project" : "Person"}</th>
              {showSub && <th className="py-2 pr-3 font-semibold">Customer</th>}
              <th className="py-2 pr-3 text-right font-semibold">Entries</th>
              <th className="py-2 text-right font-semibold">Hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, r]) => (
              <tr key={id} className="border-b border-fp-border last:border-0">
                <td className="py-2 pr-3 font-semibold">
                  {href ? (
                    <Link href={href(id)} className="hover:text-fp-pink">
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </td>
                {showSub && <td className="py-2 pr-3">{r.sub}</td>}
                <td className="py-2 pr-3 text-right">{r.entries}</td>
                <td className="py-2 text-right font-semibold">{hoursText(r.hours)}</td>
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
        <strong>{hoursText(total)}</strong> logged in this period.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {table("Hours by project", sorted(byProject), true, (id) => `/projects/${id}`)}
        {table("Hours by person", sorted(byPerson), false)}
      </div>
    </>
  );
}

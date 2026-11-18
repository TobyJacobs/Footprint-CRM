import Link from "next/link";
import { Flag } from "lucide-react";
import { Badge } from "@/components/ui";
import { longDate } from "@/lib/customers/display";
import type { JobRow } from "@/lib/design/jobs";
import { designStageLabel, designStageTone, jobNumber } from "@/lib/design/options";

// A job is late when its due date has passed and it isn't finished.
export const isLate = (j: Pick<JobRow, "due_date" | "stage">, today: string) =>
  !!j.due_date && j.due_date < today && j.stage !== "done" && j.stage !== "production";

export function DueDate({ job, today }: { job: Pick<JobRow, "due_date" | "stage">; today: string }) {
  if (!job.due_date) return <span className="text-fp-mid">No due date</span>;
  if (isLate(job, today)) return <span className="font-semibold text-fp-error">Late: was due {longDate(job.due_date)}</span>;
  if (job.due_date === today) return <span className="font-semibold text-fp-dark">Due today</span>;
  return <span>Due {longDate(job.due_date)}</span>;
}

export function PriorityFlag({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-fp-pink" title="High priority">
      <Flag size={13} aria-hidden fill="currentColor" /> High priority
    </span>
  );
}

// One job as a list of rows (the List and My jobs pages, and on orders/projects).
export function JobsTable({
  jobs,
  nameOf,
  today,
  showDesigner = true,
  empty = "No design jobs here.",
}: {
  jobs: JobRow[];
  nameOf: Map<string, string>;
  today: string;
  showDesigner?: boolean;
  empty?: string;
}) {
  if (jobs.length === 0) return <p className="text-sm text-fp-mid">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-fp-border bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-fp-offwhite text-left text-xs uppercase tracking-wide text-fp-mid">
          <tr>
            <th className="px-4 py-2">Job</th>
            <th className="px-4 py-2">Customer</th>
            {showDesigner && <th className="px-4 py-2">Designer</th>}
            <th className="px-4 py-2">Stage</th>
            <th className="px-4 py-2">Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-fp-border">
          {jobs.map((j) => (
            <tr key={j.id} className={isLate(j, today) ? "bg-fp-error/5" : undefined}>
              <td className="px-4 py-2">
                <Link href={`/design/${j.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                  {jobNumber(j.number)} · {j.title}
                </Link>
                {j.high_priority && (
                  <div>
                    <PriorityFlag on />
                  </div>
                )}
              </td>
              <td className="px-4 py-2">{j.customer?.name ?? <span className="text-fp-mid">Footprint</span>}</td>
              {showDesigner && <td className="px-4 py-2">{j.designer_id ? nameOf.get(j.designer_id) ?? "—" : <span className="text-fp-mid">Not assigned</span>}</td>}
              <td className="px-4 py-2">
                <Badge tone={designStageTone(j.stage)}>{designStageLabel(j.stage)}</Badge>
              </td>
              <td className="px-4 py-2">
                <DueDate job={j} today={today} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

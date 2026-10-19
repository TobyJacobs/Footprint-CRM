import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { loadJobs } from "@/lib/design/jobs";
import { designStageLabel, designStageTone, jobNumber } from "@/lib/design/options";
import { createClient } from "@/lib/supabase/server";

// "Design jobs" card for a sales order, project or customer page: the jobs
// linked to it and a button to raise a new one. Hidden from people without
// Design access.
export default async function DesignJobsPanel({ order, project, customer }: { order?: string; project?: string; customer?: string }) {
  const user = await getCurrentUser();
  if (!user.can("design", "view")) return null;
  const supabase = await createClient();
  const jobs = await loadJobs(supabase, {
    salesOrderId: order ?? null,
    projectId: project ?? null,
    customerId: customer ?? null,
    includeAllDone: true,
  });
  const newHref = `/design/new?${order ? `order=${order}` : project ? `project=${project}` : `customer=${customer}`}`;
  return (
    <Card
      title="Design jobs"
      action={
        <Link href={newHref} className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline">
          <Plus size={14} aria-hidden /> Create design job
        </Link>
      }
    >
      {jobs.length === 0 ? (
        <p className="text-sm text-fp-mid">No design jobs yet.</p>
      ) : (
        <ul className="grid gap-2 text-sm">
          {jobs.slice(0, 10).map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-2">
              <Link href={`/design/${j.id}`} className="truncate font-semibold text-fp-teal-deep hover:underline">
                {jobNumber(j.number)} · {j.title}
              </Link>
              <Badge tone={designStageTone(j.stage)}>{designStageLabel(j.stage)}</Badge>
            </li>
          ))}
          {jobs.length > 10 && customer && (
            <li>
              <Link href={`/design/list?customer=${customer}&finished=1`} className="text-fp-teal-deep hover:underline">
                See all {jobs.length}
              </Link>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

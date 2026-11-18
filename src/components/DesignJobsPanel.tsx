import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { loadJobs } from "@/lib/design/jobs";
import { designStageLabel, designStageTone, jobNumber } from "@/lib/design/options";
import { createClient } from "@/lib/supabase/server";

// "Design jobs" card for a sales order, project or customer page: the jobs
// linked to it. New jobs start from a project or a sales order (neither needs
// the other), so the button shows on both. Hidden from people without Design
// access.
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
  // A sales order raises jobs through its project.
  const orderProject = order
    ? (await supabase.from("projects").select("id").eq("sales_document_id", order).maybeSingle()).data?.id ?? null
    : null;
  const fromProject = project ?? orderProject;
  // From an order, go through the order (it uses the order's project if it has
  // one, or links the job straight to the order: DJ, 11 November 2026).
  const newHref = order ? `/design/new?order=${order}` : fromProject ? `/design/new?project=${fromProject}` : null;
  return (
    <Card
      title="Design jobs"
      action={
        newHref ? (
          <Link href={newHref} className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline">
            <Plus size={14} aria-hidden /> Create design job
          </Link>
        ) : undefined
      }
    >
      {!newHref && (
        <p className="mb-2 text-xs text-fp-mid">
          Design jobs are started from one of this customer&apos;s projects or sales orders.
        </p>
      )}
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

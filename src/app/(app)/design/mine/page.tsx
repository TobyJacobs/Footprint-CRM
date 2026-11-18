import type { Metadata } from "next";
import Link from "next/link";
import { Notice, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { loadJobs, loadPeople } from "@/lib/design/jobs";
import { todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { JobsTable, isLate } from "../parts";

export const metadata: Metadata = { title: "My design jobs" };

// The jobs assigned to me, and the ones I asked for.
export default async function MyDesignJobsPage(props: PageProps<"/design/mine">) {
  const user = await requirePermission("design", "view");
  const sp = await props.searchParams;
  const today = todayIso();
  const supabase = await createClient();
  const [mine, { nameOf }, askedFor] = await Promise.all([
    loadJobs(supabase, { designerId: user.id }),
    loadPeople(supabase),
    loadJobs(supabase, { requestedBy: user.id }),
  ]);
  const requested = askedFor.filter((j) => j.designer_id !== user.id);
  const late = mine.filter((j) => isLate(j, today)).length;

  return (
    <div className="grid gap-8">
      <Notice searchParams={sp} />
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black">
            Assigned to me <span className="text-sm font-semibold text-fp-mid">({mine.length}{late ? `, ${late} late` : ""})</span>
          </h2>
          <Link href={`/design?designer=${user.id}`} className={secondaryButton}>
            See them on the board
          </Link>
        </div>
        <JobsTable jobs={mine} nameOf={nameOf} today={today} showDesigner={false} empty="Nothing assigned to you right now." />
      </section>
      {requested.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg font-black">
            Jobs I asked for <span className="text-sm font-semibold text-fp-mid">({requested.length})</span>
          </h2>
          <JobsTable jobs={requested} nameOf={nameOf} today={today} />
        </section>
      )}
    </div>
  );
}

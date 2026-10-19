import Link from "next/link";
import { Plus } from "lucide-react";
import { Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { loadJobs, loadPeople } from "@/lib/design/jobs";
import { designStages, jobNumber, nextStage, designStageLabel } from "@/lib/design/options";
import { todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { setJobStage } from "./actions";
import { DueDate, PriorityFlag, isLate } from "./parts";

const UUID = /^[0-9a-f-]{36}$/i;

// The board: one column per stage, like monday.com. Finished jobs show for
// two weeks, then drop off (they're still in the List).
export default async function DesignBoardPage(props: PageProps<"/design">) {
  const user = await requirePermission("design", "view");
  const sp = await props.searchParams;
  const designer = typeof sp.designer === "string" && UUID.test(sp.designer) ? sp.designer : "";
  const priority = sp.priority === "1";
  const canEdit = user.can("design", "edit");
  const today = todayIso();
  const supabase = await createClient();
  const [jobs, { pickable, nameOf }] = await Promise.all([
    loadJobs(supabase, { designerId: designer || null, highPriorityOnly: priority, doneWithinDays: 14 }),
    loadPeople(supabase),
  ]);
  const here = `/design?${new URLSearchParams({ ...(designer ? { designer } : {}), ...(priority ? { priority: "1" } : {}) }).toString()}`;
  const late = jobs.filter((j) => isLate(j, today)).length;

  return (
    <div className="grid gap-6">
      <Notice searchParams={sp} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <label className="grid gap-1">
            <span className="font-semibold">Designer</span>
            <select name="designer" defaultValue={designer} className={inputClass}>
              <option value="">Everyone</option>
              {pickable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2">
            <input type="checkbox" name="priority" value="1" defaultChecked={priority} className="accent-fp-pink" />
            High priority only
          </label>
          <button type="submit" className={secondaryButton}>
            Filter
          </button>
        </form>
        <Link href="/design/new" className={`${primaryButton} inline-flex items-center gap-2`}>
          <Plus size={16} aria-hidden /> New design job
        </Link>
      </div>

      {late > 0 && (
        <p className="rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-sm text-fp-error">
          {late === 1 ? "1 job is" : `${late} jobs are`} past their due date.
        </p>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1260px] grid-cols-7 gap-3">
          {designStages.map((s) => {
            const col = jobs.filter((j) => j.stage === s.value);
            const next = nextStage[s.value];
            return (
              <section key={s.value} className="flex flex-col gap-2 rounded-lg bg-fp-offwhite p-2" aria-label={s.label}>
                <h2 className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-fp-mid">
                  {s.label} <span className="rounded-full bg-white px-2 py-0.5 text-fp-dark">{col.length}</span>
                </h2>
                {col.map((j) => (
                  <article
                    key={j.id}
                    className={`grid gap-1 rounded-md border bg-white p-3 text-sm ${
                      isLate(j, today) ? "border-fp-error/50" : j.high_priority ? "border-fp-pink/50" : "border-fp-border"
                    }`}
                  >
                    <Link href={`/design/${j.id}`} className="font-semibold leading-snug hover:text-fp-pink">
                      {j.title}
                    </Link>
                    <p className="text-xs text-fp-mid">
                      {jobNumber(j.number)} · {j.customer?.name ?? "Footprint"}
                    </p>
                    <PriorityFlag on={j.high_priority} />
                    <p className="text-xs">
                      <DueDate job={j} today={today} />
                    </p>
                    <p className="text-xs text-fp-dark/75">{j.designer_id ? nameOf.get(j.designer_id) ?? "—" : "Not assigned"}</p>
                    {canEdit && next && (
                      <form action={setJobStage.bind(null, j.id)} className="mt-1">
                        <input type="hidden" name="stage" value={next} />
                        <input type="hidden" name="back" value={here} />
                        <button type="submit" className="text-xs font-semibold text-fp-teal-deep hover:underline">
                          Move to {designStageLabel(next)} →
                        </button>
                      </form>
                    )}
                  </article>
                ))}
                {col.length === 0 && <p className="px-1 py-2 text-xs text-fp-mid">Nothing here</p>}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

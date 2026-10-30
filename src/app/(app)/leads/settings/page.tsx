import type { Metadata } from "next";
import Link from "next/link";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Card, Notice, inputClass, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { quoteBusinessUnits } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";
import { addPipeline, addStage, deleteStage, saveStage } from "../actions";

export const metadata: Metadata = { title: "Lead pipeline stages" };

// Rename, reorder and add stages, and add pipelines (Marketing edit).
export default async function LeadSettings(props: PageProps<"/leads/settings">) {
  const user = await getCurrentUser();
  if (!user.can("marketing", "edit")) return <NoAccess title="Lead pipeline stages" />;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: pipelines }, { data: stages }] = await Promise.all([
    supabase.from("lead_pipelines").select("id, name, business_unit").eq("active", true).order("position"),
    supabase.from("lead_stages").select("id, pipeline_id, name, position, kind").order("position"),
  ]);

  return (
    <>
      <PageHeader title="Lead pipeline stages" intro="Each business area's stages. Won and Lost stages count as closed. A stage with leads in it can't be removed." />
      <div className="grid max-w-4xl gap-5 px-4 py-6 sm:px-6 lg:px-10">
        <Link href="/leads" className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Lead pipelines
        </Link>
        <Notice searchParams={sp} />
        {(pipelines ?? []).map((p) => (
          <Card key={p.id} title={p.name}>
            <ul className="grid gap-2 text-sm">
              {(stages ?? [])
                .filter((s) => s.pipeline_id === p.id)
                .map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2">
                    <form action={saveStage.bind(null, s.id)} className="flex flex-1 flex-wrap items-center gap-2">
                      <input name="position" type="number" defaultValue={s.position} aria-label="Order" className={`${inputClass} w-16`} />
                      <input name="name" required defaultValue={s.name} aria-label="Stage name" className={`${inputClass} w-48 flex-1`} />
                      <select name="kind" defaultValue={s.kind} aria-label="Kind" className={`${inputClass} w-auto`}>
                        <option value="open">Open</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                      </select>
                      <button type="submit" className={secondaryButton}>
                        Save
                      </button>
                    </form>
                    <form action={deleteStage.bind(null, s.id)}>
                      <button type="submit" className="text-xs font-semibold text-fp-error hover:underline">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
            </ul>
            <form action={addStage.bind(null, p.id)} className="mt-3 flex gap-2 text-sm">
              <input name="name" required placeholder="New stage" aria-label="New stage" className={`${inputClass} w-56`} />
              <button type="submit" className={secondaryButton}>
                Add stage
              </button>
            </form>
          </Card>
        ))}
        <Card title="Add a pipeline">
          <form action={addPipeline} className="flex flex-wrap gap-2 text-sm">
            <input name="name" required placeholder="e.g. Websites" aria-label="Pipeline name" className={`${inputClass} w-56`} />
            <select name="business_unit" defaultValue="" aria-label="Business unit" className={`${inputClass} w-auto`}>
              <option value="">No business unit</option>
              {quoteBusinessUnits.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            <button type="submit" className={secondaryButton}>
              Add pipeline
            </button>
          </form>
          <p className="mt-2 text-xs text-fp-mid">New pipelines start with the usual six stages, which you can then change.</p>
        </Card>
      </div>
    </>
  );
}

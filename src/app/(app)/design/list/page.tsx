import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { loadJobs, loadPeople } from "@/lib/design/jobs";
import { designStages, isDesignStage } from "@/lib/design/options";
import { todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { JobsTable } from "../parts";

export const metadata: Metadata = { title: "Design jobs" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function DesignListPage(props: PageProps<"/design/list">) {
  await requirePermission("design", "view");
  const sp = await props.searchParams;
  const designer = typeof sp.designer === "string" && UUID.test(sp.designer) ? sp.designer : "";
  const customer = typeof sp.customer === "string" && UUID.test(sp.customer) ? sp.customer : "";
  const stage = isDesignStage(sp.stage) ? sp.stage : "";
  const priority = sp.priority === "1";
  const finished = sp.finished === "1";
  const supabase = await createClient();
  const [jobs, { pickable, nameOf }, { data: filterCustomer }] = await Promise.all([
    loadJobs(supabase, {
      designerId: designer || null,
      customerId: customer || null,
      stage: stage || null,
      highPriorityOnly: priority,
      includeAllDone: finished,
    }),
    loadPeople(supabase),
    customer ? supabase.from("customers").select("id, name").eq("id", customer).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="grid gap-6">
      <Notice searchParams={sp} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex flex-wrap items-end gap-3 text-sm">
          {customer && <input type="hidden" name="customer" value={customer} />}
          <label className="grid gap-1">
            <span className="font-semibold">Stage</span>
            <select name="stage" defaultValue={stage} className={inputClass}>
              <option value="">All open stages</option>
              {designStages.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
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
          <label className="flex items-center gap-2 pb-2">
            <input type="checkbox" name="finished" value="1" defaultChecked={finished} className="accent-fp-pink" />
            Include finished jobs
          </label>
          <button type="submit" className={secondaryButton}>
            Filter
          </button>
        </form>
        <Link href={`/design/new${customer ? `?customer=${customer}` : ""}`} className={`${primaryButton} inline-flex items-center gap-2`}>
          <Plus size={16} aria-hidden /> New design job
        </Link>
      </div>
      {filterCustomer && (
        <p className="text-sm">
          Customer: <strong>{filterCustomer.name}</strong>{" "}
          <Link href="/design/list" className="text-fp-teal-deep hover:underline">
            show all customers
          </Link>
        </p>
      )}
      <JobsTable jobs={jobs} nameOf={nameOf} today={todayIso()} empty="No design jobs match these filters." />
    </div>
  );
}

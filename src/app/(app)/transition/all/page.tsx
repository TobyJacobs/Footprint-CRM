import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { currentWeek, isStatus, loadTransition, shortDay, statusLabels, streamColour, weekOf, type Action } from "@/lib/transition";
import { saveAction } from "../actions";
import { ActionFields, ActionPanel, BoardLabel, RowStatus, StreamTag, TransitionTabs, monoDate } from "../parts";
import RememberFilters from "../RememberFilters";

export const metadata: Metadata = { title: "Transition actions" };

const FILTERS = ["stream", "owner", "status", "week", "mine"] as const;

// Every action, grouped by phase, with filters (remembered per person).
export default async function TransitionRegister(props: PageProps<"/transition/all">) {
  const user = await getCurrentUser();
  if (!user.transitionAccess) return <NoAccess title="Transition" />;
  const sp = await props.searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  // Coming back with no filters: use the ones this person had last time.
  const query = new URLSearchParams();
  for (const k of FILTERS) if (get(k)) query.set(k, get(k));
  if (!query.size && !get("clear") && !get("open") && !get("add") && !get("saved") && !get("deleted") && !get("error")) {
    const saved = (await cookies()).get("fp_transition_filters")?.value;
    if (saved && /^[\w=&%.-]+$/.test(saved)) redirect(`/transition/all?${saved}`);
  }

  const data = await loadTransition(user.transitionAccess, user.previewRole);
  const { weeks } = data;
  const now = currentWeek(weeks);
  const stream = get("stream");
  const owner = get("owner");
  const status = get("status");
  const week = get("week");
  const mine = get("mine") === "1";

  const rows = data.actions.filter(
    (a) =>
      (!stream || a.stream === stream) &&
      (!owner || (owner === "none" ? !a.owner_id : a.owner_id === owner)) &&
      (!isStatus(status) || a.status === status) &&
      (!week || String(weekOf(a.due_date, weeks)?.number) === week) &&
      (!mine || (!!data.myDirectoryId && a.owner_id === data.myDirectoryId)),
  );
  const here = `/transition/all${query.size ? `?${query}` : ""}`;
  const withQ = (q: string) => `${here}${here.includes("?") ? "&" : "?"}${q}`;
  const openId = get("open");
  const open = openId ? data.actions.find((a) => a.id === openId) : undefined;
  const nameOf = (id: string | null) => data.people.find((p) => p.id === id)?.name ?? "—";
  const streamName = (k: string) => data.streams.find((s) => s.key === k)?.name ?? k;
  const canAdd = data.access === "full" || data.access === "member";
  const owners = data.people.filter((p) => data.actions.some((a) => a.owner_id === p.id));
  const phases = [...new Set(rows.map((a) => a.phase ?? 0))].sort((x, y) => x - y);
  const doneCount = data.actions.filter((a) => a.status === "done").length;

  const chip = (k: (typeof FILTERS)[number], v: string, label: string, colour?: string) => {
    const q = new URLSearchParams(query);
    if (v) q.set(k, v);
    else q.delete(k);
    const on = (get(k) || "") === v;
    return (
      <Link
        key={`${k}-${v}`}
        href={`/transition/all${q.size ? `?${q}` : "?clear=1"}`}
        aria-pressed={on}
        className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-fp-black bg-fp-black text-white" : "border-fp-border bg-white hover:border-fp-pink"}`}
        style={!on && colour ? { borderColor: colour, color: colour } : undefined}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <PageHeader title="FootprintAI transition" intro="Every action, grouped by phase. Click one to see or change it." />
      <TransitionTabs current="actions" full={data.access === "full"} />
      <RememberFilters query={query.toString()} />
      <div className="grid gap-5 px-4 py-6 sm:px-6 lg:px-10">
        <Notice searchParams={sp} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-fp-dark/75">
            {rows.length} shown · {doneCount} of {data.actions.length} done
          </span>
          {canAdd && (
            <Link href={withQ("add=1")} scroll={false} className={`${primaryButton} ml-auto`}>
              Add action
            </Link>
          )}
        </div>

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-fp-mid">Stream</span>
            {chip("stream", "", "All")}
            {data.streams.map((s) => chip("stream", s.key, s.name, streamColour(s.key).c))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-fp-mid">Owner</span>
            {chip("owner", "", "Everyone")}
            {owners.map((p) => chip("owner", p.id, p.name.split(" ")[0]))}
            {data.myDirectoryId && chip("mine", get("mine") === "1" ? "" : "1", mine ? "Mine ✓" : "Mine")}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-fp-mid">Status</span>
            {chip("status", "", "Any")}
            {Object.entries(statusLabels).map(([v, l]) => chip("status", v, l))}
          </div>
          <form method="get" className="flex flex-wrap items-center gap-1.5 text-xs">
            {FILTERS.filter((k) => k !== "week" && get(k)).map((k) => (
              <input key={k} type="hidden" name={k} value={get(k)} />
            ))}
            <label htmlFor="wk" className="mr-1 font-mono text-[11px] uppercase tracking-wider text-fp-mid">
              Week
            </label>
            <select id="wk" name="week" defaultValue={week} className={`${inputClass} w-auto py-1 text-xs`}>
              <option value="">Any week</option>
              {weeks.map((w) => (
                <option key={w.number} value={w.number}>
                  {w.number > 8 && w.number === weeks[weeks.length - 1].number ? "After Christmas" : `Week ${w.number}`} · {shortDay(w.meeting_date)}
                </option>
              ))}
            </select>
            <button type="submit" className={`${secondaryButton} px-2 py-1 text-xs`}>
              Show
            </button>
            {query.size > 0 && (
              <Link href="/transition/all?clear=1" className="ml-2 font-semibold text-fp-teal-deep hover:underline">
                Clear filters
              </Link>
            )}
          </form>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-md border border-fp-border bg-white px-4 py-6 text-center text-sm text-fp-mid">No actions match these filters.</p>
        ) : (
          phases.map((ph) => {
            const p = data.phases.find((x) => x.number === ph);
            const list = rows.filter((a) => (a.phase ?? 0) === ph);
            return (
              <section key={ph}>
                <h3 className="mb-2 flex flex-wrap items-baseline gap-2 font-bold">
                  {p ? `Phase ${p.number} · ${p.name}` : "No phase"}
                  {p?.label && <span className="font-mono text-xs font-normal text-fp-mid">{p.label}</span>}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-fp-border bg-white">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-fp-border font-mono text-[11px] uppercase tracking-wider text-fp-mid">
                        <th className="w-1/2 px-3 py-2 font-medium">Action</th>
                        <th className="px-3 py-2 font-medium">Stream</th>
                        <th className="px-3 py-2 font-medium">Owner</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-fp-border">
                      {list.map((a: Action) => {
                        const thisWeek = !!now && weekOf(a.due_date, weeks)?.number === now.number;
                        return (
                          <tr key={a.id} className="align-top" style={{ boxShadow: `inset 4px 0 0 ${streamColour(a.stream).c}` }}>
                            <td className="px-3 py-2.5">
                              <Link href={withQ(`open=${a.id}`)} scroll={false} className="block hover:underline">
                                <span className="font-mono text-xs text-fp-mid">{a.ref}</span>{" "}
                                <b>{a.title}</b>
                                {a.visibility === "board" && <BoardLabel />}
                              </Link>
                              {a.detail && <span className="mt-0.5 block text-[13px] text-fp-dark/65">{a.detail}</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              <StreamTag stream={a.stream} name={streamName(a.stream)} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{nameOf(a.owner_id)}</td>
                            <td className="px-3 py-2.5">
                              <RowStatus data={data} a={a} back={here} />
                            </td>
                            <td className={`px-3 py-2.5 ${monoDate} ${thisWeek ? "font-bold text-fp-pink" : ""}`}>
                              Wed {shortDay(weekOf(a.due_date, weeks)?.meeting_date ?? a.due_date)}
                              {thisWeek ? " ●" : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        )}
      </div>

      {open && <ActionPanel data={data} a={open} back={withQ(`open=${open.id}`)} closeHref={here} />}
      {get("add") && canAdd && (
        <aside
          aria-label="Add action"
          className="fixed inset-0 z-40 overflow-y-auto bg-white p-5 shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[30rem] sm:border-l sm:border-fp-border"
        >
          <div className="mb-3 flex items-start justify-between">
            <h2 className="text-lg font-black">Add an action</h2>
            <Link href={here} aria-label="Close" className="rounded-md p-1 hover:bg-fp-light">
              <X size={18} aria-hidden />
            </Link>
          </div>
          <form action={saveAction.bind(null, null)} className="grid gap-3 text-sm">
            <input type="hidden" name="back" value={here} />
            <input type="hidden" name="full" value="1" />
            <ActionFields data={data} defaultDue={now?.meeting_date} />
            <button type="submit" className={`${primaryButton} justify-self-start`}>
              Add action
            </button>
          </form>
        </aside>
      )}
    </>
  );
}

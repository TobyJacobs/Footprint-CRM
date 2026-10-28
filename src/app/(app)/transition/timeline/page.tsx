import type { Metadata } from "next";
import Link from "next/link";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { currentWeek, loadTransition, shortDay, statusLabels, streamColour, weekOf } from "@/lib/transition";
import { TransitionTabs } from "../parts";

export const metadata: Metadata = { title: "Transition timeline" };

const statusDot: Record<string, string> = {
  not_started: "#ffffff",
  in_progress: "#fab200",
  blocked: "#c81e1e",
  done: "#0092a3",
};
const hatch = "repeating-linear-gradient(135deg, #f0eef2 0 6px, transparent 6px 12px)";

// Swimlanes: the four streams down the side, the meeting weeks across the top,
// each action as a chip in its week coloured by status, gates as lines.
export default async function TransitionTimeline() {
  const user = await getCurrentUser();
  if (!user.transitionAccess) return <NoAccess title="Transition" />;
  const data = await loadTransition(user.transitionAccess, user.previewRole);
  const { weeks } = data;
  const now = currentWeek(weeks);
  const cols = `150px repeat(${weeks.length}, minmax(0, 1fr))`;
  const isXmas = (n: number) => n > 8 && n === weeks[weeks.length - 1]?.number;
  const nameOf = (id: string | null) => data.people.find((p) => p.id === id)?.name ?? "No owner";
  const doneCount = data.actions.filter((a) => a.status === "done").length;
  const phaseSpans = data.phases
    .map((p) => {
      const idx = weeks.map((w, i) => (w.phase === p.number ? i : -1)).filter((i) => i >= 0);
      return idx.length ? { p, from: idx[0], to: idx[idx.length - 1] } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  // A gate on the meeting Wednesday sits in the middle of its column; the
  // launch (a Tuesday) a little before.
  const gateLines = data.gates
    .map((g) => {
      const w = weekOf(g.date, weeks);
      const i = w ? weeks.indexOf(w) : -1;
      return i < 0 ? null : { g, i, at: g.date === w!.meeting_date ? 50 : 36 };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <>
      <PageHeader title="FootprintAI transition" intro="The whole programme at a glance: streams, weeks, gates and every action." />
      <TransitionTabs current="timeline" full={data.access === "full"} />
      <div className="grid gap-5 px-4 py-6 sm:px-6 lg:px-10">
        <div>
          <p className="mb-1 text-sm font-semibold">
            {doneCount} of {data.actions.length} done
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-fp-light" aria-hidden>
            <div className="bg-fp-gradient h-2" style={{ width: `${data.actions.length ? (doneCount / data.actions.length) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-fp-border bg-white">
          <div className="relative grid min-w-[980px]" style={{ gridTemplateColumns: cols }}>
            {/* Week gridlines, the Christmas hatching and gate lines */}
            <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: cols }} aria-hidden>
              <div />
              {weeks.map((w, i) => (
                <div key={w.number} className="relative border-l border-fp-border" style={isXmas(w.number) ? { background: hatch } : undefined}>
                  {gateLines
                    .filter((x) => x.i === i)
                    .map(({ g, at }) => (
                      <div
                        key={g.id}
                        className="absolute bottom-0 top-12"
                        style={{
                          left: `${at}%`,
                          borderLeft: g.is_launch ? "2px solid #de2277" : "2px dashed rgba(0,0,0,0.35)",
                        }}
                      />
                    ))}
                </div>
              ))}
            </div>

            {/* Headers */}
            <div className="border-b border-fp-border px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-fp-mid">Stream</div>
            {weeks.map((w) => {
              const isNow = now?.number === w.number;
              return (
                <div key={w.number} className={`relative border-b border-fp-border px-1 py-3 text-center font-mono text-[11.5px] ${isNow ? "text-fp-pink" : "text-fp-mid"}`}>
                  <span className="block text-[10px] uppercase tracking-wider opacity-75">{isXmas(w.number) ? "After break" : `Wk ${w.number}`}</span>
                  {isXmas(w.number) ? `Jan ${w.meeting_date.slice(2, 4)}` : shortDay(w.meeting_date)}
                  {isNow && (
                    <span className="absolute -bottom-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-fp-pink px-1.5 text-[9.5px] text-white">
                      This week
                    </span>
                  )}
                </div>
              );
            })}

            {/* Phase band */}
            <div className="border-b border-fp-border bg-fp-light px-3 py-1.5 text-[11.5px] font-semibold">Phase</div>
            {weeks.map((w, i) => {
              const span = phaseSpans.find((s) => s.from === i);
              if (span) {
                return (
                  <div
                    key={w.number}
                    className="truncate border-b border-fp-border bg-fp-light px-2 py-1.5 text-[11.5px] font-semibold"
                    style={{ gridColumn: `span ${span.to - span.from + 1}` }}
                  >
                    {span.p.number} · {span.p.name}
                  </div>
                );
              }
              return phaseSpans.some((s) => i > s.from && i <= s.to) ? null : (
                <div key={w.number} className="border-b border-fp-border bg-fp-light" />
              );
            })}

            {/* One lane per stream */}
            {data.streams.map((s) => {
              const { c, tint } = streamColour(s.key);
              return (
                <div key={s.key} className="contents">
                  <div className="flex flex-col justify-center gap-0.5 border-b border-fp-border px-3 py-3 text-[13px] font-semibold">
                    <span className="mb-1 h-1 w-6 rounded" style={{ background: c }} />
                    {s.name}
                    {s.subtitle && <i className="text-[11.5px] font-medium not-italic text-fp-mid">{s.subtitle}</i>}
                  </div>
                  {weeks.map((w) => {
                    const items = data.actions.filter((a) => a.stream === s.key && weekOf(a.due_date, weeks)?.number === w.number);
                    return (
                      <div key={w.number} className="relative flex flex-col gap-1 border-b border-fp-border p-1.5">
                        {items.map((a) => (
                          <Link
                            key={a.id}
                            href={`/transition/all?open=${a.id}`}
                            title={`${a.ref} ${a.title} · ${nameOf(a.owner_id)} · ${statusLabels[a.status]}`}
                            className="flex items-center gap-1.5 truncate rounded-md border py-0.5 pl-2 pr-1.5 text-[11px] font-semibold hover:brightness-95"
                            style={{
                              background: isXmas(w.number) ? "transparent" : tint,
                              borderColor: c,
                              borderStyle: isXmas(w.number) ? "dashed" : "solid",
                              boxShadow: `inset 4px 0 0 ${c}`,
                            }}
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full border"
                              style={{ background: statusDot[a.status], borderColor: a.status === "not_started" ? "#888" : statusDot[a.status] }}
                              aria-label={statusLabels[a.status]}
                            />
                            <span className="truncate">{a.ref}</span>
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-fp-dark/75">
          {Object.entries(statusLabels).map(([k, l]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border" style={{ background: statusDot[k], borderColor: k === "not_started" ? "#888" : statusDot[k] }} />
              {l}
            </span>
          ))}
          <span>· Hover a chip for its title and owner; click to open it.</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.gates.map((g) => (
            <div key={g.id} className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-xl border border-fp-border bg-white p-3">
              <span className="row-span-2 mt-1.5 h-3.5 w-3.5 rotate-45" style={{ background: g.is_launch ? "#de2277" : "#000" }} aria-hidden />
              <h4 className="text-sm font-bold">
                {g.name} <span className="ml-1 font-mono text-[11.5px] font-medium text-fp-mid">{shortDay(g.date)}</span>
              </h4>
              <p className="text-[13px] text-fp-dark/75">{g.description}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-fp-mid">
          FootprintOS&apos;s own build waves stay on the{" "}
          <Link href="/roadmap" className="font-semibold text-fp-teal-deep hover:underline">
            Roadmap
          </Link>
          . Agent testing and scorecards stay in{" "}
          <Link href="/ai" className="font-semibold text-fp-teal-deep hover:underline">
            FootprintAI
          </Link>
          .
        </p>
      </div>
    </>
  );
}

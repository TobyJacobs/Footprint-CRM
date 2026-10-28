import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Notice } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { currentWeek, loadTransition, meetingLabel, shortDay, streamColour, weekOf, weeksOverdue, type Action } from "@/lib/transition";
import { ActionPanel, BoardLabel, RowStatus, StreamTag, TransitionTabs, monoDate } from "./parts";

export const metadata: Metadata = { title: "Transition" };

// This week: what's due at this Wednesday's meeting plus anything overdue,
// grouped by owner so the meeting can go round the room.
export default async function TransitionThisWeek(props: PageProps<"/transition">) {
  const user = await getCurrentUser();
  if (!user.transitionAccess) return <NoAccess title="Transition" />;
  const sp = await props.searchParams;
  const data = await loadTransition(user.transitionAccess, user.previewRole);
  const { weeks } = data;
  const now = currentWeek(weeks);
  const asked = typeof sp.week === "string" ? weeks.find((w) => String(w.number) === sp.week) : undefined;
  const week = asked ?? now;
  const lastNumber = weeks[weeks.length - 1]?.number;

  const here = `/transition${asked ? `?week=${asked.number}` : ""}`;
  const openId = typeof sp.open === "string" ? sp.open : null;
  const open = openId ? data.actions.find((a) => a.id === openId) : undefined;
  const linkTo = (a: Action) => `${here}${here.includes("?") ? "&" : "?"}open=${a.id}`;

  const dueNow = week ? data.actions.filter((a) => weekOf(a.due_date, weeks)?.number === week.number) : [];
  const overdue = week ? data.actions.filter((a) => weeksOverdue(a, week, weeks) > 0) : [];
  const owners = new Map<string, { name: string; due: Action[]; overdue: Action[] }>();
  const nameOf = (id: string | null) => data.people.find((p) => p.id === id)?.name ?? "No owner yet";
  for (const [list, kind] of [
    [overdue, "overdue"],
    [dueNow, "due"],
  ] as const) {
    for (const a of list) {
      const k = a.owner_id ?? "none";
      if (!owners.has(k)) owners.set(k, { name: nameOf(a.owner_id), due: [], overdue: [] });
      owners.get(k)![kind].push(a);
    }
  }
  const groups = [...owners.entries()].sort((x, y) => (x[0] === "none" ? 1 : y[0] === "none" ? -1 : x[1].name.localeCompare(y[1].name)));
  const gatesNow = week ? data.gates.filter((g) => weekOf(g.date, weeks)?.number === week.number && g.date <= week.meeting_date) : [];
  const doneCount = data.actions.filter((a) => a.status === "done").length;
  const streamName = (k: string) => data.streams.find((s) => s.key === k)?.name ?? k;

  const row = (a: Action, late: number) => (
    <li key={a.id} className="relative">
      <Link
        href={linkTo(a)}
        scroll={false}
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-white py-2 pl-3 pr-2 hover:border-fp-pink ${
          late ? "border-fp-error/40" : "border-fp-border"
        }`}
        style={{ boxShadow: `inset 4px 0 0 ${streamColour(a.stream).c}` }}
      >
        <span className="font-mono text-xs text-fp-mid">{a.ref}</span>
        <span className="min-w-0 flex-1 font-semibold">
          {a.title}
          {a.visibility === "board" && <BoardLabel />}
        </span>
        <StreamTag stream={a.stream} name={streamName(a.stream)} />
        <span className={`${monoDate} ${late ? "font-bold text-fp-error" : "text-fp-dark/75"}`}>
          {late ? `${late} week${late === 1 ? "" : "s"} overdue · ` : ""}
          {shortDay(a.due_date)}
        </span>
        <span className="w-28" />
      </Link>
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <RowStatus data={data} a={a} back={open ? `${here}${here.includes("?") ? "&" : "?"}open=${open.id}` : here} />
      </div>
    </li>
  );

  return (
    <>
      <PageHeader title="FootprintAI transition" intro="What's due at this Wednesday's meeting, who owns it and where it's up to." />
      <TransitionTabs current="week" full={data.access === "full"} />
      <div className="grid gap-5 px-4 py-6 sm:px-6 lg:px-10">
        <Notice searchParams={sp} />
        {data.weeks.length === 0 ? (
          <p className="text-sm text-fp-mid">The transition plan hasn&apos;t been loaded yet.</p>
        ) : week ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              {week.number > weeks[0].number && (
                <Link href={`/transition?week=${week.number - 1}`} className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline">
                  <ChevronLeft size={16} aria-hidden /> {week.number - 1 === lastNumber && lastNumber > 8 ? "After Christmas" : `Week ${week.number - 1}`}
                </Link>
              )}
              <h2 className="text-xl font-black">
                {week.number === lastNumber && week.number > 8 ? "After Christmas" : `Week ${week.number}`} · {meetingLabel(week.meeting_date)}
                {now && week.number === now.number && <span className="ml-2 rounded-full bg-fp-pink px-2 py-0.5 align-middle text-xs font-bold text-white">This week</span>}
              </h2>
              {week.number < lastNumber && (
                <Link href={`/transition?week=${week.number + 1}`} className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline">
                  {week.number + 1 === lastNumber && lastNumber > 8 ? "After Christmas" : `Week ${week.number + 1}`} <ChevronRight size={16} aria-hidden />
                </Link>
              )}
              <span className="ml-auto text-sm text-fp-dark/75">
                {doneCount} of {data.actions.length} done
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-fp-light" aria-hidden>
              <div className="bg-fp-gradient h-2" style={{ width: `${data.actions.length ? (doneCount / data.actions.length) * 100 : 0}%` }} />
            </div>

            {gatesNow.map((g) => (
              <p
                key={g.id}
                className={`rounded-md border px-4 py-3 text-sm ${g.is_launch ? "border-fp-pink bg-fp-pink/5" : "border-fp-black/20 bg-white"}`}
              >
                <strong>{g.is_launch ? "Launch this week" : "Gate this week"}: {g.name}</strong> ({shortDay(g.date)}). {g.description}
              </p>
            ))}

            {groups.length === 0 ? (
              <p className="rounded-md border border-fp-border bg-white px-4 py-6 text-center text-sm text-fp-mid">Nothing due this week and nothing overdue.</p>
            ) : (
              <div className="grid gap-5">
                {groups.map(([k, g]) => (
                  <section key={k}>
                    <h3 className="mb-2 font-bold">
                      {g.name}{" "}
                      <span className="text-sm font-normal text-fp-dark/75">
                        · {g.due.length} due{g.overdue.length ? ` · ` : ""}
                        {g.overdue.length > 0 && <span className="font-semibold text-fp-error">{g.overdue.length} overdue</span>}
                      </span>
                    </h3>
                    <ul className="grid gap-1.5 text-sm">
                      {g.overdue.map((a) => row(a, weeksOverdue(a, week, weeks)))}
                      {g.due.map((a) => row(a, 0))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
      {open && <ActionPanel data={data} a={open} back={linkTo(open)} closeHref={here} />}
    </>
  );
}

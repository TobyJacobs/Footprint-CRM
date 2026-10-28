import Link from "next/link";
import { X } from "lucide-react";
import { inputClass, primaryButton, secondaryButton, dangerButton } from "@/components/ui";
import { shortDateTime } from "@/lib/customers/display";
import { createClient } from "@/lib/supabase/server";
import {
  canEditFully,
  canUpdate,
  meetingLabel,
  shortDay,
  statusLabels,
  streamColour,
  weekOf,
  type Action,
  type TransitionData,
} from "@/lib/transition";
import { addActionUpdate, deleteAction, saveAction, setActionStatus } from "./actions";
import StatusSelect from "./StatusSelect";

export function TransitionTabs({ current, full }: { current: "week" | "actions" | "timeline" | "people"; full: boolean }) {
  const tabs = [
    { key: "week", label: "This week", href: "/transition" },
    { key: "actions", label: "All actions", href: "/transition/all" },
    { key: "timeline", label: "Timeline", href: "/transition/timeline" },
    ...(full ? [{ key: "people", label: "Invite list", href: "/transition/people" }] : []),
  ];
  return (
    <nav aria-label="Transition" className="flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 lg:px-10">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
            t.key === current ? "border-fp-pink text-fp-black" : "border-transparent text-fp-mid hover:text-fp-black"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function StreamTag({ stream, name }: { stream: string; name: string }) {
  const { c, tint } = streamColour(stream);
  return (
    <span className="inline-block whitespace-nowrap rounded px-2 py-0.5 text-[11.5px] font-bold" style={{ color: c, background: tint }}>
      {name}
    </span>
  );
}

export function BoardLabel() {
  return (
    <span className="ml-1.5 rounded border px-1 align-[1px] text-[11px] font-bold" style={{ color: "#6b4fd8", borderColor: "#6b4fd8" }}>
      Board
    </span>
  );
}

export const monoDate = "font-mono text-[12.5px] tabular-nums whitespace-nowrap";

// The status picker for a row: editable for anyone who may update the action.
export function RowStatus({ data, a, back }: { data: TransitionData; a: Action; back: string }) {
  return <StatusSelect status={a.status} action={setActionStatus.bind(null, a.id)} back={back} disabled={!canUpdate(data, a)} />;
}

// The side panel for one action: everything about it, editable within the
// person's permissions, plus its short update thread.
export async function ActionPanel({ data, a, back, closeHref }: { data: TransitionData; a: Action; back: string; closeHref: string }) {
  const supabase = await createClient();
  const { data: updates } = await supabase
    .from("transition_action_updates")
    .select("id, body, created_at, profiles(full_name, email)")
    .eq("action_id", a.id)
    .order("created_at");
  const full = canEditFully(data, a);
  const ownerOnly = !full && canUpdate(data, a);
  const owner = data.people.find((p) => p.id === a.owner_id)?.name ?? "No owner yet";
  const stream = data.streams.find((s) => s.key === a.stream);
  const week = weekOf(a.due_date, data.weeks);

  return (
    <aside
      aria-label={`${a.ref} ${a.title}`}
      className="fixed inset-0 z-40 overflow-y-auto bg-white p-5 shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[30rem] sm:border-l sm:border-fp-border"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-fp-mid">{a.ref}</p>
          <h2 className="text-lg font-black">
            {a.title}
            {a.visibility === "board" && <BoardLabel />}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fp-mid">
            {stream && <StreamTag stream={stream.key} name={stream.name} />}
            {owner} · due {meetingLabel(a.due_date)}
            {week ? ` · Week ${week.number}` : ""}
          </p>
        </div>
        <Link href={closeHref} aria-label="Close" className="rounded-md p-1 hover:bg-fp-light">
          <X size={18} aria-hidden />
        </Link>
      </div>

      {full ? (
        <form action={saveAction.bind(null, a.id)} className="grid gap-3 text-sm">
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="full" value="1" />
          <ActionFields data={data} a={a} />
          <button type="submit" className={`${primaryButton} justify-self-start`}>
            Save
          </button>
        </form>
      ) : (
        <div className="grid gap-3 text-sm">
          {a.detail && <p className="whitespace-pre-wrap text-fp-dark/80">{a.detail}</p>}
          {ownerOnly ? (
            <form action={saveAction.bind(null, a.id)} className="grid gap-3">
              <input type="hidden" name="back" value={back} />
              <label className="grid gap-1">
                <span className="font-semibold">Status</span>
                <select name="status" defaultValue={a.status} className={inputClass}>
                  {Object.entries(statusLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="font-semibold">Notes</span>
                <textarea name="notes" rows={4} maxLength={5000} defaultValue={a.notes ?? ""} className={inputClass} />
              </label>
              <button type="submit" className={`${primaryButton} justify-self-start`}>
                Save
              </button>
              <p className="text-xs text-fp-mid">As the owner you can change the status and notes.</p>
            </form>
          ) : (
            a.notes && <p className="whitespace-pre-wrap">{a.notes}</p>
          )}
        </div>
      )}

      <section className="mt-6 border-t border-fp-border pt-4 text-sm">
        <h3 className="mb-2 font-bold">Updates</h3>
        {(updates ?? []).length === 0 ? (
          <p className="text-xs text-fp-mid">No updates yet.</p>
        ) : (
          <ol className="grid gap-2">
            {(updates ?? []).map((u) => {
              const who = u.profiles as unknown as { full_name: string | null; email: string } | null;
              return (
                <li key={u.id} className="rounded-md bg-fp-offwhite p-2">
                  <p className="text-xs text-fp-mid">
                    {who?.full_name ?? who?.email ?? "Someone"} · {shortDateTime(u.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap">{u.body}</p>
                </li>
              );
            })}
          </ol>
        )}
        <form action={addActionUpdate.bind(null, a.id)} className="mt-3 grid gap-2">
          <input type="hidden" name="back" value={back} />
          <textarea name="body" rows={2} maxLength={2000} required placeholder="Add an update…" aria-label="Add an update" className={inputClass} />
          <button type="submit" className={`${secondaryButton} justify-self-start`}>
            Add update
          </button>
        </form>
      </section>

      {data.access === "full" && (
        <details className="mt-6 border-t border-fp-border pt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-fp-error">Delete this action…</summary>
          <form action={deleteAction.bind(null, a.id)} className="mt-2 grid gap-2">
            <input type="hidden" name="back" value={back} />
            <p>
              Delete <strong>{a.ref}</strong> and its updates for good? This can&apos;t be undone (it stays in the audit log).
            </p>
            <button type="submit" className={`${dangerButton} justify-self-start`}>
              Yes, delete it
            </button>
          </form>
        </details>
      )}
      <p className="mt-6 text-xs text-fp-mid">
        Last changed {shortDateTime(a.updated_at)}
        {a.completed_at ? ` · done ${shortDay(a.completed_at.slice(0, 10))}` : ""}
      </p>
    </aside>
  );
}

// The editable fields, shared by the side panel and Add action.
export function ActionFields({ data, a, defaultDue }: { data: TransitionData; a?: Action; defaultDue?: string }) {
  return (
    <>
      <label className="grid gap-1">
        <span className="font-semibold">Title</span>
        <input name="title" required maxLength={300} defaultValue={a?.title ?? ""} className={inputClass} />
      </label>
      <label className="grid gap-1">
        <span className="font-semibold">Detail</span>
        <textarea name="detail" rows={4} maxLength={5000} defaultValue={a?.detail ?? ""} className={inputClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="font-semibold">Stream</span>
          <select name="stream" required defaultValue={a?.stream ?? data.streams[0]?.key} className={inputClass}>
            {data.streams.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Owner</span>
          <select name="owner_id" defaultValue={a?.owner_id ?? ""} className={inputClass}>
            <option value="">No owner yet</option>
            {data.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Due</span>
          <input name="due_date" type="date" required defaultValue={a?.due_date ?? defaultDue} className={inputClass} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Status</span>
          <select name="status" defaultValue={a?.status ?? "not_started"} className={inputClass}>
            {Object.entries(statusLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      {data.access === "full" && (
        <label className="grid gap-1">
          <span className="font-semibold">Who can see it</span>
          <select name="visibility" defaultValue={a?.visibility ?? "all"} className={inputClass}>
            <option value="all">Everyone on the transition</option>
            <option value="board">Board only</option>
          </select>
        </label>
      )}
      <label className="grid gap-1">
        <span className="font-semibold">Notes</span>
        <textarea name="notes" rows={3} maxLength={5000} defaultValue={a?.notes ?? ""} className={inputClass} />
      </label>
    </>
  );
}


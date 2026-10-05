import { Badge, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { shortDateTime } from "@/lib/customers/display";
import { features } from "@/lib/features";
import { approveRequest, denyRequest, queryRequest, replyToRequest } from "./actions";

export type Wave = { id: string; code: string; title: string; description: string | null; on_hold: boolean; position: number };
export type RoadmapRequest = {
  id: string;
  kind: "bug" | "suggestion";
  title: string;
  details: string | null;
  wave_id: string | null;
  page: string | null;
  status: "pending" | "query" | "approved" | "denied" | "done";
  admin_note: string | null;
  submitted_by: string;
  submitted_at: string;
  decided_at: string | null;
};
export type Comment = { id: string; request_id: string; author_id: string; body: string; created_at: string };

// The pages a request can be about.
export const pageOptions = ["Home", ...features.map((f) => f.label), "Sign-in / login", "Other"];

export const waveLabel = (w: Wave) => (/^\d/.test(w.code) ? `Wave ${w.code}: ${w.title}` : w.title);

export function RequestStatusBadge({ status }: { status: RoadmapRequest["status"] }) {
  if (status === "pending") return <Badge tone="amber">Waiting for review</Badge>;
  if (status === "query") return <Badge tone="pink">Question for you</Badge>;
  if (status === "approved") return <Badge tone="teal">Approved: on the roadmap</Badge>;
  if (status === "done") return <Badge tone="teal">Done</Badge>;
  return <Badge tone="red">Not going ahead</Badge>;
}

export function KindBadge({ kind }: { kind: RoadmapRequest["kind"] }) {
  return kind === "bug" ? <Badge tone="red">Bug</Badge> : <Badge>Suggestion</Badge>;
}

// One request, with its conversation. Admins get Approve / Query / Deny; the
// sender can reply when there's a question for them.
export function RequestCard({
  r,
  waves,
  comments,
  names,
  me,
  isAdmin,
  showActions,
}: {
  r: RoadmapRequest;
  waves: Wave[];
  comments: Comment[];
  names: Map<string, string>;
  me: string;
  isAdmin: boolean;
  showActions: boolean;
}) {
  const wave = waves.find((w) => w.id === r.wave_id);
  const mine = r.submitted_by === me;
  return (
    <article className="rounded-lg border border-fp-border bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={r.kind} />
        <RequestStatusBadge status={r.status} />
        <span className="text-xs text-fp-mid">
          {names.get(r.submitted_by) ?? "Someone"} · {shortDateTime(r.submitted_at)}
        </span>
      </div>
      <h3 className="mt-2 font-bold">{r.title}</h3>
      <p className="text-xs text-fp-dark/70">
        {[wave ? waveLabel(wave) : null, r.page].filter(Boolean).join(" · ") || "No wave or page given"}
      </p>
      {r.details && <p className="mt-2 whitespace-pre-line">{r.details}</p>}

      {comments.length > 0 && (
        <ul className="mt-3 grid gap-2 border-l-2 border-fp-border pl-3">
          {comments.map((c) => (
            <li key={c.id}>
              <span className="text-xs font-semibold">{names.get(c.author_id) ?? "Someone"}</span>
              <span className="text-xs text-fp-mid"> · {shortDateTime(c.created_at)}</span>
              <p className="whitespace-pre-line">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {r.admin_note && (
        <p className="mt-3 rounded-md bg-fp-offwhite px-3 py-2">
          <span className="font-semibold">Admin note: </span>
          {r.admin_note}
        </p>
      )}

      {mine && r.status === "query" && (
        <form action={replyToRequest.bind(null, r.id)} className="mt-3 grid gap-2">
          <textarea name="body" rows={2} required placeholder="Your answer…" className={inputClass} />
          <div>
            <button type="submit" className={primaryButton}>Send reply</button>
          </div>
        </form>
      )}

      {isAdmin && showActions && (r.status === "pending" || r.status === "query") && (
        <div className="mt-4 grid gap-3 border-t border-fp-border pt-3">
          <details className="rounded-md border border-fp-teal-deep/30 p-3" open={r.status === "pending"}>
            <summary className="cursor-pointer font-semibold text-fp-teal-deep">Approve: add to the roadmap</summary>
            <form action={approveRequest.bind(null, r.id)} className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold">Wave</span>
                <select name="wave_id" defaultValue={r.wave_id ?? ""} required className={inputClass}>
                  <option value="" disabled>Choose a wave…</option>
                  {waves.map((w) => (
                    <option key={w.id} value={w.id}>{waveLabel(w)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold">Roadmap task</span>
                <input name="task_title" defaultValue={`${r.kind === "bug" ? "Fix: " : ""}${r.title}`} required className={inputClass} />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-semibold">Note to the sender (optional)</span>
                <input name="note" className={inputClass} />
              </label>
              <div>
                <button type="submit" className={primaryButton}>Approve</button>
              </div>
            </form>
          </details>
          <details className="rounded-md border border-fp-border p-3">
            <summary className="cursor-pointer font-semibold">Query: ask a question</summary>
            <form action={queryRequest.bind(null, r.id)} className="mt-2 grid gap-2">
              <textarea name="question" rows={2} required className={inputClass} />
              <div>
                <button type="submit" className={secondaryButton}>Send question</button>
              </div>
            </form>
          </details>
          <details className="rounded-md border border-fp-border p-3">
            <summary className="cursor-pointer font-semibold text-fp-error">Deny</summary>
            <form action={denyRequest.bind(null, r.id)} className="mt-2 grid gap-2">
              <input name="note" required placeholder="Short reason, so they know why" className={inputClass} />
              <div>
                <button type="submit" className={secondaryButton}>Deny request</button>
              </div>
            </form>
          </details>
        </div>
      )}
    </article>
  );
}

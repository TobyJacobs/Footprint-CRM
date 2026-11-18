import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { toolLabel } from "@/lib/ai/bot-tools";
import { gbp, shortDateTime } from "@/lib/customers/display";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { BotAvatar, Pane, PaneHeader, PersonAvatar, RunStatus } from "../../parts";
import RunDriver from "./RunDriver";

export const metadata: Metadata = { title: "Bot run" };

type Step = { at: string; tool: string; summary: string };

// One request to a bot: what was asked, each step it took, the drafts it made
// and its answer.
export default async function RunPage(props: PageProps<"/ai/control-room/runs/[runId]">) {
  const user = await requirePermission("ai", "view");
  const { runId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(runId)) notFound();
  const supabase = await createClient();
  const { data: run } = await supabase
    .from("ai_bot_runs")
    .select("id, request, status, reply, steps, draft_ids, source, requested_by, created_at, finished_at, ai_bots(name, engine)")
    .eq("id", runId)
    .maybeSingle();
  if (!run) notFound();
  const [{ data: drafts }, { nameOf }] = await Promise.all([
    run.draft_ids.length
      ? supabase.from("sales_documents").select("id, number, title, status, total, customers!sales_documents_customer_id_fkey(name)").in("id", run.draft_ids)
      : Promise.resolve({ data: [] as never[] }),
    loadPeople(supabase),
  ]);
  const steps = (run.steps as Step[]) ?? [];
  const bot = run.ai_bots as unknown as { name: string; engine: string } | null;
  const botName = bot?.name ?? "Bot";
  const asker = run.source === "outside" ? "An outside bot" : (nameOf.get(run.requested_by ?? "") ?? "Someone");
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/London" });
  const mine = run.source === "control_room" && run.requested_by === user.id;

  return (
    <>
      <PaneHeader
        title={
          <span className="flex items-center gap-2">
            <BotAvatar name={botName} engine={bot?.engine ?? "outside"} size="sm" /> {botName}
          </span>
        }
        sub={`Asked by ${asker} · ${shortDateTime(run.created_at)}`}
      >
        <RunStatus status={run.status} />
      </PaneHeader>
      <Pane>
        {/* The request, as a message */}
        <div className="flex gap-3">
          <PersonAvatar name={asker} />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-bold">{asker}</span> <span className="text-xs text-fp-mid">{shortDateTime(run.created_at)}</span>
            </p>
            <p className="mt-1 whitespace-pre-wrap rounded-xl rounded-tl-sm bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-fp-border">{run.request}</p>
          </div>
        </div>

        {run.status === "running" && mine && <RunDriver runId={run.id} />}

        {/* What it did, as a live log */}
        <div className="overflow-hidden rounded-xl bg-fp-black shadow-xl ring-1 ring-black/20">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-fp-amber/80" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" aria-hidden />
            <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">What it did</span>
          </div>
          <ol className="grid gap-1.5 px-4 py-4 font-mono text-xs leading-relaxed text-white/80">
            <li className="text-white/40">
              <span className="text-fp-pink-light">$</span> {botName.toLowerCase().replace(/\s+/g, "-")} --job &quot;{run.request.slice(0, 60)}
              {run.request.length > 60 ? "…" : ""}&quot;
            </li>
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 text-white/35">{time(s.at)}</span>
                <span>
                  <span className="text-emerald-300">✓ {toolLabel[s.tool] ?? s.tool}</span>
                  <span className="text-white/55"> · {s.summary}</span>
                </span>
              </li>
            ))}
            {run.status === "running" ? (
              <li className="flex items-center gap-2 text-fp-amber">
                <span>Thinking</span>
                <span className="inline-block h-3.5 w-1.5 animate-pulse bg-fp-amber" aria-hidden />
              </li>
            ) : (
              <li className={run.status === "done" ? "text-emerald-300" : run.status === "stopped" ? "text-white/50" : "text-red-400"}>
                {steps.length === 0 && run.status === "done" ? "No tools needed. " : ""}
                {run.status === "done" ? "■ Finished" : run.status === "stopped" ? "■ Stopped" : "■ Didn't finish"}
                {run.finished_at ? ` at ${time(run.finished_at)}` : ""}
              </li>
            )}
          </ol>
        </div>

        {(drafts ?? []).length > 0 && (
          <section className="rounded-xl border-2 border-fp-teal bg-white p-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-fp-teal-deep">Drafts to check</h3>
            <ul className="mt-3 grid gap-2">
              {(drafts ?? []).map((d) => (
                <li key={d.id}>
                  <Link href={`/sales/${d.id}`} className="flex flex-wrap items-center gap-3 rounded-lg bg-fp-offwhite px-3 py-2 text-sm hover:bg-fp-teal/10">
                    <span className="font-bold text-fp-teal-deep">Quote {d.number}</span>
                    <span>{(d.customers as unknown as { name: string } | null)?.name}</span>
                    {d.title && <span className="text-fp-mid">{d.title}</span>}
                    <span className="ml-auto font-mono font-semibold">{gbp(Number(d.total))}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-fp-mid">Open each draft, check the customer, lines and prices, then send it as usual.</p>
          </section>
        )}

        {run.reply && (
          <div className="flex gap-3">
            <BotAvatar name={botName} engine={bot?.engine ?? "outside"} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-bold">{botName}</span>
                <span className="ml-1.5 rounded bg-fp-black px-1 py-px font-mono text-[9px] font-bold uppercase tracking-wider text-white">bot</span>{" "}
                {run.finished_at && <span className="text-xs text-fp-mid">{shortDateTime(run.finished_at)}</span>}
              </p>
              <p
                className={`mt-1 whitespace-pre-wrap rounded-xl rounded-tl-sm px-4 py-3 text-sm shadow-sm ${
                  run.status === "failed" ? "bg-red-50 text-red-900 ring-1 ring-red-200" : "bg-white ring-1 ring-fp-border"
                }`}
              >
                {run.reply}
              </p>
            </div>
          </div>
        )}
      </Pane>
    </>
  );
}

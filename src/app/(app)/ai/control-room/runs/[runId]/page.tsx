import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { toolLabel } from "@/lib/ai/bot-tools";
import { gbp, shortDateTime } from "@/lib/customers/display";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { RunStatus } from "../../parts";
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
    .select("id, request, status, reply, steps, draft_ids, source, requested_by, created_at, finished_at, ai_bots(name)")
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
  const botName = (run.ai_bots as unknown as { name: string } | null)?.name ?? "Bot";
  const mine = run.source === "control_room" && run.requested_by === user.id;

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/ai/control-room" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Control room
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-black">{botName}</h2>
        <RunStatus status={run.status} />
      </div>
      <p className="text-sm text-fp-mid">
        Asked by {run.source === "outside" ? "an outside bot" : (nameOf.get(run.requested_by ?? "") ?? "—")} · {shortDateTime(run.created_at)}
      </p>

      <Card title="The request">
        <p className="whitespace-pre-wrap text-sm">{run.request}</p>
      </Card>

      {run.status === "running" && mine && <RunDriver runId={run.id} />}

      {(drafts ?? []).length > 0 && (
        <Card title="Drafts to check">
          <ul className="grid gap-2">
            {(drafts ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 text-sm">
                <Link href={`/sales/${d.id}`} className="font-bold text-fp-teal-deep hover:underline">
                  Quote {d.number}
                </Link>
                <span>{(d.customers as unknown as { name: string } | null)?.name}</span>
                {d.title && <span className="text-fp-mid">{d.title}</span>}
                <span className="ml-auto font-semibold">{gbp(Number(d.total))}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fp-mid">Open each draft, check the customer, lines and prices, then send it as usual.</p>
        </Card>
      )}

      {run.reply && (
        <Card title={`${botName} says`}>
          <p className="whitespace-pre-wrap text-sm">{run.reply}</p>
        </Card>
      )}

      <Card title="What it did">
        {steps.length === 0 ? (
          <p className="text-sm text-fp-mid">{run.status === "running" ? "Thinking…" : "It didn't use any tools."}</p>
        ) : (
          <ol className="grid gap-2 text-sm">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 shrink-0 text-right font-mono text-xs text-fp-mid">{i + 1}.</span>
                <span>
                  <span className="font-semibold">{toolLabel[s.tool] ?? s.tool}</span>
                  <span className="text-fp-mid"> · {s.summary}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

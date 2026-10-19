import { Badge } from "@/components/ui";
import { aiStageLabel, criteria, progressIndex, progressSteps, scoreLabel } from "@/lib/ai/options";

// Planned → Shadow → Assisted → Supervised → Live, with the current step lit.
export function ProgressBar({ stage, compact }: { stage: string; compact?: boolean }) {
  const current = progressIndex(stage);
  const onHold = stage === "on_hold";
  return (
    <div>
      <ol className="flex gap-1" aria-label={`Progress: ${aiStageLabel(stage)}`}>
        {progressSteps.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={`h-2 rounded-full ${onHold ? "bg-fp-light" : i <= current ? "bg-fp-pink" : "bg-fp-light"}`} />
            {!compact && (
              <span className={`mt-1 block text-[11px] ${i === current && !onHold ? "font-bold text-fp-black" : "text-fp-mid"}`}>{aiStageLabel(s)}</span>
            )}
          </li>
        ))}
      </ol>
      {onHold && <p className="mt-1 text-xs font-semibold text-fp-mid">On hold</p>}
    </div>
  );
}

const dotColour: Record<string, string> = {
  pass: "bg-fp-teal-deep",
  fail: "bg-fp-error",
  on_track: "bg-fp-amber",
  not_started: "bg-fp-light border border-fp-border",
};

// Seven dots, one per scorecard row, plus "3 of 7 passed".
export function ScoreDots({ scores }: { scores: { criterion: string; status: string }[] }) {
  const by = new Map(scores.map((s) => [s.criterion, s.status]));
  const passed = scores.filter((s) => s.status === "pass").length;
  const failed = scores.filter((s) => s.status === "fail").length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {criteria.map((c) => {
          const status = by.get(c.value) ?? "not_started";
          return <span key={c.value} title={`${c.label}: ${scoreLabel(status)}`} className={`inline-block h-3 w-3 rounded-full ${dotColour[status] ?? dotColour.not_started}`} />;
        })}
      </div>
      <span className="text-xs text-fp-mid">
        {passed} of {criteria.length} passed
      </span>
      {failed > 0 && <Badge tone="red">{failed} failing</Badge>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md bg-fp-offwhite p-3">
      <p className="text-xs font-semibold text-fp-mid">{label}</p>
      <p className="text-lg font-black">{value}</p>
      {hint && <p className="text-xs text-fp-mid">{hint}</p>}
    </div>
  );
}

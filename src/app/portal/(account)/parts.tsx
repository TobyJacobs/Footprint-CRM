import { Check } from "lucide-react";
import { ukToday } from "@/lib/dates";
import type { PortalCampaign, PortalContent, PortalQuote } from "@/lib/portal";

// Shared pieces for the portal's pages.

export type Tone = "grey" | "teal" | "pink" | "amber" | "red";

// Each page's title bar and content area, laid out like FootprintOS.
export function PortalPage({ title, intro, action, children }: { title: string; intro?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-fp-border bg-white px-6 py-8 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
            {intro && <p className="mt-2 max-w-2xl text-fp-dark/80">{intro}</p>}
          </div>
          {action}
        </div>
      </div>
      <div className="grid max-w-5xl gap-6 px-6 py-8 lg:px-10">{children}</div>
    </>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-fp-border bg-white px-4 py-8 text-center text-sm text-fp-mid">{children}</p>;
}

export const longMonth = (d: string) =>
  new Date(`${d.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export const contentLabel: Record<PortalContent["status"], string> = {
  drafting: "Being written",
  client_approval: "Waiting for your approval",
  scheduled: "Scheduled",
  published: "Published",
};
export const contentTone: Record<PortalContent["status"], Tone> = { drafting: "grey", client_approval: "pink", scheduled: "amber", published: "teal" };
export const campaignLabel: Record<PortalCampaign["status"], string> = { planned: "Planned", live: "Live", paused: "Paused", ended: "Ended" };
export const campaignTone: Record<PortalCampaign["status"], Tone> = { planned: "grey", live: "teal", paused: "amber", ended: "grey" };

export function quoteStatus(q: PortalQuote): { label: string; tone: Tone } {
  if (q.status === "accepted" || q.status === "converted") return { label: "Accepted", tone: "teal" };
  if (q.status === "declined") return { label: "Declined", tone: "grey" };
  if (q.valid_until && q.valid_until < ukToday()) return { label: "Expired", tone: "grey" };
  return { label: "Waiting for your reply", tone: "pink" };
}

// A design job's progress, in the customer's words. Amends count as "Being
// designed" (we're making their changes).
const designSteps = ["Brief received", "Being designed", "Your approval", "Approved", "In production"];
const designStep: Record<string, number> = { todo: 0, in_design: 1, amends: 1, with_customer: 2, approved: 3, production: 4, done: 5 };

export function DesignTracker({ stage }: { stage: string }) {
  const at = designStep[stage] ?? 0;
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs" aria-label="Progress">
      {designSteps.map((label, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={label} className="flex items-center gap-1">
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                done ? "bg-fp-teal/15 text-fp-teal-deep" : current ? (i === 2 ? "bg-fp-pink text-white" : "bg-fp-amber/20 text-fp-dark") : "bg-fp-light text-fp-mid"
              }`}
              aria-current={current ? "step" : undefined}
            >
              {done && <Check size={12} aria-hidden />}
              {label}
            </span>
            {i < designSteps.length - 1 && <span className="text-fp-border" aria-hidden>›</span>}
          </li>
        );
      })}
    </ol>
  );
}

import { Badge } from "@/components/ui";

// How a run is going, as a coloured label.
export function RunStatus({ status }: { status: string }) {
  if (status === "running") return <Badge tone="amber">Working</Badge>;
  if (status === "done") return <Badge tone="teal">Done</Badge>;
  if (status === "stopped") return <Badge>Stopped</Badge>;
  return <Badge tone="red">Didn&apos;t finish</Badge>;
}

// The same, as a small light (for lists).
export function StatusLight({ status, className = "" }: { status: "ready" | "waiting" | "off" | "running" | "done" | "failed" | "stopped" | string; className?: string }) {
  const tone =
    status === "ready" || status === "done"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
      : status === "running"
        ? "animate-pulse bg-fp-amber shadow-[0_0_8px_rgba(250,178,0,0.8)]"
        : status === "waiting"
          ? "bg-fp-amber"
          : status === "failed"
            ? "bg-red-500"
            : "bg-white/30";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${tone} ${className}`} aria-hidden />;
}

// A bot's badge: its first letters on its engine's colour.
const engineTone: Record<string, string> = {
  claude: "bg-gradient-to-br from-fp-orange to-fp-pink text-white",
  grok: "bg-gradient-to-br from-zinc-200 to-zinc-500 text-fp-black",
  outside: "bg-gradient-to-br from-fp-teal to-fp-teal-deep text-white",
};
export function BotAvatar({ name, engine, size = "md" }: { name: string; engine: string; size?: "sm" | "md" | "lg" }) {
  const letters =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  const dims = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-lg font-black tracking-tight ${dims} ${engineTone[engine] ?? engineTone.outside}`} aria-hidden>
      {letters}
    </span>
  );
}

// A person's badge in chats.
export function PersonAvatar({ name }: { name: string }) {
  const letters =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fp-black text-xs font-bold text-white" aria-hidden>
      {letters}
    </span>
  );
}

// The scrolling work area on the right of the control room.
export function Pane({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={`grid gap-6 p-4 sm:p-6 ${wide ? "" : "max-w-4xl"}`}>{children}</div>
    </div>
  );
}

// A heading strip at the top of the work area.
export function PaneHeader({ title, sub, children }: { title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-fp-border bg-white px-4 py-3 sm:px-6">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-black">{title}</h2>
        {sub && <p className="truncate text-xs text-fp-mid">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

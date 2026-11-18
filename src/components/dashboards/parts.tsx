import Link from "next/link";

// Small building blocks shared by the role dashboards and the Staff hub.

export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
export const moneyExact = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export function Tile({
  label,
  value,
  note,
  tone,
  href,
}: {
  label: string;
  value: string;
  note?: React.ReactNode;
  tone?: "pink" | "teal" | "red" | "amber";
  href?: string;
}) {
  const colour =
    tone === "red" ? "text-fp-error" : tone === "teal" ? "text-fp-teal-deep" : tone === "pink" ? "text-fp-pink" : tone === "amber" ? "text-fp-orange" : "";
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-fp-mid">{label}</p>
      <p className={`mt-1 text-2xl font-black ${colour}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-fp-dark/70">{note}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg border border-fp-border bg-white p-4 transition-shadow hover:shadow-md">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-fp-border bg-white p-4">{body}</div>
  );
}

// Progress towards a goal, with a marker for where we "should" be by today.
export function GoalBar({
  title,
  actual,
  target,
  pacePct,
  format = money,
  example,
  rate,
}: {
  title: string;
  actual: number;
  target: number | null;
  pacePct?: number | null;
  format?: (n: number) => string;
  example?: boolean;
  // A rate like margin %: compared in points above/below the target instead.
  rate?: boolean;
}) {
  const pct = target && target > 0 ? Math.round((actual / target) * 100) : null;
  const ahead = pct !== null && pacePct != null ? pct >= pacePct : null;
  return (
    <div className="rounded-lg border border-fp-border bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold">
          {title}
          {example && <span className="ml-2 rounded-full bg-fp-amber/20 px-2 py-0.5 text-xs font-semibold">Example target</span>}
        </p>
        <p className="text-sm text-fp-dark/75">
          {target ? (
            <>
              <span className="text-2xl font-black text-fp-black">{format(actual)}</span> of {format(target)}
            </>
          ) : (
            <span className="text-2xl font-black text-fp-black">{format(actual)}</span>
          )}
        </p>
      </div>
      {target ? (
        <>
          <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-fp-light">
            <div
              className={`h-full rounded-full ${ahead === false ? "bg-fp-orange" : "bg-fp-gradient"}`}
              style={{ width: `${Math.min(100, rate ? actual : pct ?? 0)}%` }}
            />
            {rate && (
              <div className="absolute top-0 h-full w-0.5 bg-fp-black/60" style={{ left: `${Math.min(100, target)}%` }} title="Target" />
            )}
            {pacePct != null && (
              <div className="absolute top-0 h-full w-0.5 bg-fp-black/60" style={{ left: `${Math.min(100, pacePct)}%` }} title="Where we should be by today" />
            )}
          </div>
          {rate ? (
            <p className="mt-2 text-sm">
              <strong className={actual >= target ? "text-fp-teal-deep" : "text-fp-orange"}>
                {Math.abs(Math.round((actual - target) * 10) / 10)} points {actual >= target ? "above" : "below"} target
              </strong>
            </p>
          ) : (
          <p className="mt-2 text-sm">
            <strong>{pct}%</strong> of target
            {pacePct != null && (
              <span className={ahead ? "text-fp-teal-deep" : "text-fp-orange"}>
                {" "}· {ahead ? "on track" : "behind"} (by today we&apos;d expect {pacePct}%)
              </span>
            )}
            {target > actual && <span className="text-fp-dark/70"> · {format(target - actual)} to go</span>}
          </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-fp-dark/70">No target set yet — an admin can add one in Admin → Targets &amp; commission.</p>
      )}
    </div>
  );
}

export function SimpleList({
  title,
  empty,
  rows,
  action,
}: {
  title: string;
  empty: string;
  rows: { key: string; href?: string; primary: React.ReactNode; secondary?: React.ReactNode; right?: React.ReactNode; tone?: "red" | "amber" }[];
  action?: { href: string; label: string };
}) {
  return (
    <section className="rounded-lg border border-fp-border bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-bold">{title}</h2>
        {action && (
          <Link href={action.href} className="text-sm font-semibold text-fp-teal-deep hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-fp-dark/70">{empty}</p>
      ) : (
        <ul className="grid gap-2 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex items-start justify-between gap-3 border-b border-fp-border pb-2 last:border-0 last:pb-0">
              <div className="min-w-0">
                {r.href ? (
                  <Link href={r.href} className="font-semibold hover:text-fp-pink">
                    {r.primary}
                  </Link>
                ) : (
                  <span className="font-semibold">{r.primary}</span>
                )}
                {r.secondary && <div className="truncate text-xs text-fp-dark/70">{r.secondary}</div>}
              </div>
              {r.right && (
                <div className={`shrink-0 text-right font-semibold ${r.tone === "red" ? "text-fp-error" : r.tone === "amber" ? "text-fp-orange" : ""}`}>
                  {r.right}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const pacePct = (dayOfMonth: number | null, daysInMonth: number) =>
  dayOfMonth === null ? null : Math.round((dayOfMonth / daysInMonth) * 100);

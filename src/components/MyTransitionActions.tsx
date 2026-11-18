import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ukToday } from "@/lib/dates";

// "My transition actions" on the home page: the person's next three open
// actions by due date, overdue first. Shown only to people who own open ones.
export default async function MyTransitionActions() {
  const user = await getCurrentUser();
  if (!user.transitionAccess) return null;
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("_my_directory_id");
  if (!me) return null;
  const { data: actions } = await supabase
    .from("transition_actions")
    .select("id, ref, title, due_date, status")
    .eq("owner_id", me as string)
    .neq("status", "done")
    .order("due_date")
    .limit(3);
  if (!actions?.length) return null;
  const today = ukToday();
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <section className="rounded-lg border border-fp-border bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-bold">My transition actions</h2>
        <Link href="/transition/all?mine=1" className="text-sm font-semibold text-fp-teal-deep hover:underline">
          All mine
        </Link>
      </div>
      <ul className="grid gap-2 text-sm">
        {actions.map((a) => {
          const overdue = a.due_date < today;
          return (
            <li key={a.id}>
              <Link href={`/transition/all?open=${a.id}`} className="flex flex-wrap items-baseline justify-between gap-2 hover:underline">
                <span>
                  <span className="font-mono text-xs text-fp-mid">{a.ref}</span> <span className="font-semibold">{a.title}</span>
                </span>
                <span className={`font-mono text-xs tabular-nums ${overdue ? "font-bold text-fp-error" : "text-fp-dark/75"}`}>
                  {overdue ? "Overdue · " : ""}
                  {day(a.due_date)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

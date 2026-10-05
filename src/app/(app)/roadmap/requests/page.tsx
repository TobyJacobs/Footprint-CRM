import type { Metadata } from "next";
import Link from "next/link";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import RoadmapTabs from "../RoadmapTabs";
import { RequestCard, type Comment, type RoadmapRequest, type Wave } from "../parts";

export const metadata: Metadata = { title: "Old requests" };

const filters = [
  { key: "all", label: "All", statuses: ["approved", "done", "denied"] },
  { key: "approved", label: "On the roadmap", statuses: ["approved"] },
  { key: "done", label: "Done", statuses: ["done"] },
  { key: "denied", label: "Not going ahead", statuses: ["denied"] },
];

// Requests that have been decided: approved, done or refused. Admins see
// everyone's; everyone else sees their own.
export default async function OldRequestsPage(props: PageProps<"/roadmap/requests">) {
  const user = await getCurrentUser();
  if (!user.can("roadmap", "view")) return <NoAccess title="Roadmap" />;
  const sp = await props.searchParams;
  const filter = filters.find((f) => f.key === sp.show) ?? filters[0];
  const supabase = await createClient();

  const [{ data: waves }, { data: requests }, { data: profiles }] = await Promise.all([
    supabase.from("roadmap_waves").select("*").order("position"),
    supabase
      .from("feedback_requests")
      .select("*")
      .in("status", filter.statuses)
      .order("decided_at", { ascending: false, nullsFirst: false })
      .limit(200),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const ids = (requests ?? []).map((r) => r.id);
  const { data: comments } = ids.length
    ? await supabase.from("feedback_comments").select("*").in("request_id", ids).order("created_at")
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name ?? p.email) as string]));

  return (
    <>
      <PageHeader
        title="Old requests"
        intro={user.isAdmin ? "Every request that's been decided." : "Your requests that have been decided."}
      />
      <RoadmapTabs current="old" isAdmin={user.isAdmin} />
      <div className="px-6 py-8 lg:px-10">
        <nav aria-label="Show" className="mb-4 flex flex-wrap gap-2 text-sm">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/roadmap/requests" : `/roadmap/requests?show=${f.key}`}
              aria-current={f.key === filter.key ? "page" : undefined}
              className={`rounded-full border px-3 py-1 font-semibold ${
                f.key === filter.key ? "border-fp-pink bg-fp-pink text-white" : "border-fp-border bg-white hover:border-fp-pink"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {(requests ?? []).length === 0 ? (
          <p className="text-sm text-fp-dark/75">No requests here yet.</p>
        ) : (
          <div className="grid max-w-3xl gap-3">
            {((requests ?? []) as RoadmapRequest[]).map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                waves={(waves ?? []) as Wave[]}
                comments={((comments ?? []) as Comment[]).filter((c) => c.request_id === r.id)}
                names={names}
                me={user.id}
                isAdmin={user.isAdmin}
                showActions={false}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

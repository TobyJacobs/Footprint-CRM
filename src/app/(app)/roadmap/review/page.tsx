import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadAttachments } from "../attachments";
import RoadmapTabs from "../RoadmapTabs";
import { RequestCard, type Comment, type RoadmapRequest, type Wave } from "../parts";

export const metadata: Metadata = { title: "Requests to review" };

// Admins only: bugs and suggestions waiting for a decision. Approve adds a task
// to the roadmap; Query asks the sender a question; Deny gives a reason.
export default async function ReviewRequestsPage(props: PageProps<"/roadmap/review">) {
  const user = await requireAdmin();
  const sp = await props.searchParams;
  const supabase = await createClient();

  const [{ data: waves }, { data: requests }, { data: profiles }] = await Promise.all([
    supabase.from("roadmap_waves").select("*").order("position"),
    supabase
      .from("feedback_requests")
      .select("*")
      .in("status", ["pending", "query"])
      .order("submitted_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const ids = (requests ?? []).map((r) => r.id);
  const { data: comments } = ids.length
    ? await supabase.from("feedback_comments").select("*").in("request_id", ids).order("created_at")
    : { data: [] };
  const filesByRequest = await loadAttachments(supabase, ids);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name ?? p.email) as string]));
  const all = (requests ?? []) as RoadmapRequest[];
  const waiting = all.filter((r) => r.status === "pending");
  const asked = all.filter((r) => r.status === "query");

  const list = (items: RoadmapRequest[]) => (
    <div className="grid gap-3">
      {items.map((r) => (
        <RequestCard
          key={r.id}
          r={r}
          waves={(waves ?? []) as Wave[]}
          comments={((comments ?? []) as Comment[]).filter((c) => c.request_id === r.id)}
          names={names}
          me={user.id}
          isAdmin
          showActions
          returnTo="/roadmap/review"
          files={filesByRequest.get(r.id)}
        />
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Requests to review"
        intro="Bugs and suggestions sent in by the team. Approve one to add it to the roadmap, ask a question, or say why it isn't going ahead."
      />
      <RoadmapTabs current="review" isAdmin />
      <div className="max-w-3xl px-6 py-8 lg:px-10">
        <Notice searchParams={sp} />
        {all.length === 0 ? (
          <p className="rounded-lg border border-fp-border bg-white p-6 text-sm text-fp-dark/75">
            Nothing waiting. New requests appear here, with a number on the tab.
          </p>
        ) : (
          <div className="grid gap-8">
            {waiting.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-black">
                  Waiting for a decision <span className="text-sm font-semibold text-fp-mid">({waiting.length})</span>
                </h2>
                {list(waiting)}
              </section>
            )}
            {asked.length > 0 && (
              <section>
                <h2 className="mb-1 text-lg font-black">
                  Waiting for the sender&apos;s answer <span className="text-sm font-semibold text-fp-mid">({asked.length})</span>
                </h2>
                <p className="mb-3 text-sm text-fp-dark/75">You asked a question. Their reply moves it back to the list above.</p>
                {list(asked)}
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

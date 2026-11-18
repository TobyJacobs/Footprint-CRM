import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Tabs along the top of the Roadmap pages. Admins also get "Requests to
// review" with a count of what's waiting.
export default async function RoadmapTabs({
  current,
  isAdmin,
}: {
  current: "roadmap" | "review" | "old";
  isAdmin: boolean;
}) {
  let waiting = 0;
  if (isAdmin) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("feedback_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    waiting = count ?? 0;
  }
  const tabs = [
    { key: "roadmap", href: "/roadmap", label: "Roadmap" },
    ...(isAdmin ? [{ key: "review", href: "/roadmap/review", label: "Requests to review" }] : []),
    { key: "old", href: "/roadmap/requests", label: isAdmin ? "Old requests" : "Old requests" },
  ];

  return (
    <nav aria-label="Roadmap" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 lg:px-10">
      {tabs.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
              active ? "border-fp-pink text-fp-black" : "border-transparent text-fp-dark/60 hover:text-fp-black"
            }`}
          >
            {t.label}
            {t.key === "review" && waiting > 0 && (
              <span className="rounded-full bg-fp-pink px-2 py-0.5 text-xs font-bold text-white">{waiting}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

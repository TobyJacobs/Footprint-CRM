"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// One row of tabs for the whole FootprintAI section: the transition tracker
// and the agents workspace. Each person sees only the tabs they're allowed.
export default function FootprintAiTabs({
  transition,
  transitionFull,
  agents,
  agentsAdmin,
}: {
  transition: boolean;
  transitionFull: boolean;
  agents: boolean;
  agentsAdmin: boolean;
}) {
  const pathname = usePathname();
  const tabs = [
    ...(transition
      ? [
          { href: "/transition", label: "This week", active: pathname === "/transition" },
          { href: "/transition/all", label: "All actions", active: pathname.startsWith("/transition/all") },
          { href: "/transition/timeline", label: "Timeline", active: pathname.startsWith("/transition/timeline") },
        ]
      : []),
    ...(agents
      ? [{ href: "/ai", label: "Agents & systems", active: pathname === "/ai" || (pathname.startsWith("/ai/") && !pathname.startsWith("/ai/members")) }]
      : []),
    ...(transition && transitionFull
      ? [{ href: "/transition/people", label: "Transition invite list", active: pathname.startsWith("/transition/people") }]
      : []),
    ...(agents && agentsAdmin ? [{ href: "/ai/members", label: "Agents invite list", active: pathname.startsWith("/ai/members") }] : []),
  ];
  return (
    <nav aria-label="FootprintAI" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 lg:px-10">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
            t.active ? "border-fp-pink text-fp-black" : "border-transparent text-fp-dark/60 hover:text-fp-black"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

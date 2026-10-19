"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AiTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/ai", label: "Projects", active: pathname === "/ai" || (pathname.startsWith("/ai/") && !pathname.startsWith("/ai/members")) },
    ...(isAdmin ? [{ href: "/ai/members", label: "Invite list", active: pathname.startsWith("/ai/members") }] : []),
  ];
  return (
    <nav aria-label="FootprintAI" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 lg:px-10">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
            t.active ? "border-fp-pink text-fp-black" : "border-transparent text-fp-dark/60 hover:text-fp-black"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

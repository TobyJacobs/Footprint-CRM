"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MarketingTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/marketing", label: "Overview", active: pathname === "/marketing" },
    { href: "/marketing/content", label: "Content calendar", active: pathname.startsWith("/marketing/content") },
    { href: "/marketing/campaigns", label: "Ad campaigns", active: pathname.startsWith("/marketing/campaigns") },
    { href: "/leads", label: "Lead pipelines", active: pathname.startsWith("/leads") },
  ];
  return (
    <nav aria-label="Marketing" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 lg:px-10">
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

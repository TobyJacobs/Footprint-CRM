"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSetSection } from "@/components/AppShell";
import { useEffect } from "react";

export type Section = "sales" | "operations";

// The tabs under the Sales or Operations heading. Also tells the side menu
// which of the two is open (both live under /sales, so the address alone
// can't say for a document page).
export default function SectionTabs({ section, tabs, label }: { section: Section; tabs: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  const setSection = useSetSection();
  useEffect(() => setSection(section), [section, setSection]);
  return (
    <nav aria-label={label} className="no-scrollbar flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 print:hidden lg:px-10">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
              active ? "border-fp-pink text-fp-black" : "border-transparent text-fp-dark/60 hover:text-fp-black"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DesignTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/design", label: "Board", active: pathname === "/design" },
    { href: "/design/list", label: "List", active: pathname.startsWith("/design/list") },
    { href: "/design/mine", label: "My jobs", active: pathname.startsWith("/design/mine") },
  ];
  return (
    <nav aria-label="Design Workload" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 lg:px-10">
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

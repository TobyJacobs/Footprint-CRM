"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ProjectsTabs({ isManager }: { isManager: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/projects", label: "Projects", active: pathname === "/projects" || (pathname.startsWith("/projects/") && !pathname.startsWith("/projects/time") && !pathname.startsWith("/projects/reports")) },
    { href: "/projects/time", label: "My time", active: pathname.startsWith("/projects/time") },
    ...(isManager ? [{ href: "/projects/reports", label: "Time reports", active: pathname.startsWith("/projects/reports") }] : []),
  ];
  return (
    <nav aria-label="Projects & Time" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 lg:px-10">
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

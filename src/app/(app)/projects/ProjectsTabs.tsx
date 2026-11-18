"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ProjectsTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const other = ["/projects/time", "/projects/reports", "/projects/templates", "/projects/rates"];
  const tabs = [
    { href: "/projects", label: "Projects", active: pathname.startsWith("/projects") && !other.some((o) => pathname.startsWith(o)) },
    { href: "/projects/time", label: "My time", active: pathname.startsWith("/projects/time") },
    { href: "/projects/reports", label: "Time reports", active: pathname.startsWith("/projects/reports") },
    { href: "/projects/templates", label: "Templates", active: pathname.startsWith("/projects/templates") },
    ...(isAdmin ? [{ href: "/projects/rates", label: "Cost rates", active: pathname.startsWith("/projects/rates") }] : []),
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

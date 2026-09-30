"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/roles", label: "Roles & permissions" },
  { href: "/admin/audit", label: "Audit log" },
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 lg:px-10">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
              active
                ? "border-fp-pink text-fp-black"
                : "border-transparent text-fp-dark/60 hover:text-fp-black"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

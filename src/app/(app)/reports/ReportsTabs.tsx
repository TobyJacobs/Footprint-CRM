"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ReportsTabs({ magazines }: { magazines: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/reports/sales", label: "Sales and profit" },
    ...(magazines ? [{ href: "/reports/magazines", label: "Magazine MI" }] : []),
    { href: "/reports/debt", label: "Money owed" },
    { href: "/reports/customers", label: "Customers" },
  ];
  return (
    <nav aria-label="Reports" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 lg:px-10">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/sales/overview", label: "Overview" },
  { href: "/sales/quotes", label: "Quotes" },
  { href: "/sales/orders", label: "Sales orders" },
  { href: "/sales/invoices", label: "Invoices" },
  { href: "/sales/credit-notes", label: "Credit notes" },
  { href: "/sales/recurring", label: "Recurring" },
  { href: "/sales/purchase-orders", label: "Purchase orders" },
  { href: "/sales/products", label: "Products" },
  { href: "/sales/suppliers", label: "Suppliers" },
];

export default function SalesTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sales & Operations" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 print:hidden lg:px-10">
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

import Link from "next/link";

// Tabs across the Magazines section.
export default function MagazineTabs({ current, canEdit }: { current: "dashboard" | "renewals" | "setup"; canEdit: boolean }) {
  const tabs = [
    { key: "dashboard", label: "Dashboard", href: "/magazines" },
    { key: "renewals", label: "Renewals", href: "/magazines/renewals" },
    ...(canEdit ? [{ key: "setup", label: "Setup", href: "/magazines/setup" }] : []),
  ];
  return (
    <nav aria-label="Magazines" className="flex gap-1 border-b border-fp-border bg-white px-6 lg:px-10">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-3 text-sm font-semibold ${
            t.key === current ? "border-fp-pink text-fp-black" : "border-transparent text-fp-mid hover:text-fp-black"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

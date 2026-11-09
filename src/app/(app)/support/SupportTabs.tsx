import Link from "next/link";

// Tabs across Customer support: messages from the customer portal, and chats
// from the websites (owner, 9 November 2026).
export default function SupportTabs({ current, chatsNeedingPerson }: { current: "portal" | "chat"; chatsNeedingPerson: number }) {
  const tabs = [
    { key: "portal", label: "Portal messages", href: "/support" },
    { key: "chat", label: chatsNeedingPerson ? `Website chat (${chatsNeedingPerson})` : "Website chat", href: "/support/chat" },
  ];
  return (
    <nav aria-label="Customer support" className="flex gap-1 border-b border-fp-border bg-white px-6 lg:px-10">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-3 text-sm font-semibold ${t.key === current ? "border-fp-pink text-fp-black" : "border-transparent text-fp-mid hover:text-fp-black"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

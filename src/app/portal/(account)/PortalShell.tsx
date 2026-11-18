"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Newspaper,
  Package,
  Palette,
  Receipt,
  Server,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOutOfPortal } from "@/app/portal/actions";

type Item = { href: string; label: string; icon: LucideIcon; badge?: keyof Badges };
type Badges = { quotes: number; design: number; invoices: number; marketing: number };

const items: Item[] = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard },
  { href: "/portal/quotes", label: "Quotes", icon: FileText, badge: "quotes" },
  { href: "/portal/orders", label: "Orders", icon: Package },
  { href: "/portal/design", label: "Design work", icon: Palette, badge: "design" },
  { href: "/portal/adverts", label: "Adverts", icon: Newspaper },
  { href: "/portal/invoices", label: "Invoices", icon: Receipt, badge: "invoices" },
  { href: "/portal/marketing", label: "Marketing", icon: Megaphone, badge: "marketing" },
  { href: "/portal/hosting", label: "Hosting", icon: Server },
  { href: "/portal/support", label: "Support", icon: LifeBuoy },
];

function Wordmark() {
  return (
    <Link href="/portal" className="block">
      <Image src="/brand/footprint-logo-white.png" alt="Footprint Group" width={150} height={44} priority />
      <span className="mt-1 block text-sm font-bold tracking-wide text-white">
        Customer <span className="text-fp-pink-light">portal</span>
      </span>
    </Link>
  );
}

function Nav({ pathname, badges }: { pathname: string; badges: Badges }) {
  return (
    <nav aria-label="Portal" className="flex flex-col gap-1">
      {items.map((item, i) => {
        const active = item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href);
        const count = item.badge ? badges[item.badge] : 0;
        const Icon = item.icon;
        return (
          <div key={item.href}>
            {i === 1 && <div className="my-2 h-px bg-white/10" />}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} className={active ? "text-fp-pink-light" : "text-white/50"} aria-hidden />
              {item.label}
              {count > 0 && (
                <span className="ml-auto rounded-full bg-fp-pink px-1.5 text-xs font-bold text-white" aria-label={`${count} waiting for you`}>
                  {count}
                </span>
              )}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function UserBox({ name, email, companies }: { name: string; email: string; companies: string[] }) {
  return (
    <div className="border-t border-white/10 px-5 py-4">
      <p className="truncate text-sm font-semibold text-white">{name}</p>
      {name !== email && <p className="truncate text-xs text-white/50">{email}</p>}
      {companies.length > 0 && <p className="mt-1 text-xs text-white/50">{companies.join(", ")}</p>}
      <form action={signOutOfPortal} className="mt-3">
        <button type="submit" className="flex items-center gap-2 text-xs font-medium text-white/65 hover:text-white">
          <LogOut size={14} aria-hidden />
          Sign out
        </button>
      </form>
    </div>
  );
}

// The portal's frame, the same layout as FootprintOS: a dark menu down the
// side on computers, a menu button at the top on phones.
export default function PortalShell({
  children,
  name,
  email,
  companies,
  badges,
}: {
  children: React.ReactNode;
  name: string;
  email: string;
  companies: string[];
  badges: Badges;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-fp-black print:hidden lg:flex">
        <div className="bg-fp-gradient h-1" />
        <div className="px-5 py-6">
          <Wordmark />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <Nav pathname={pathname} badges={badges} />
        </div>
        <UserBox name={name} email={email} companies={companies} />
      </aside>

      <header className="sticky top-0 z-20 bg-fp-black print:hidden lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Wordmark />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="portal-mobile-nav"
            className="rounded-md p-2 text-white hover:bg-white/10"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
        <div className="bg-fp-gradient h-1" />
        {menuOpen && (
          <div
            id="portal-mobile-nav"
            className="max-h-[80vh] overflow-y-auto pt-2"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
            }}
          >
            <div className="px-3 pb-4">
              <Nav pathname={pathname} badges={badges} />
            </div>
            <UserBox name={name} email={email} companies={companies} />
          </div>
        )}
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

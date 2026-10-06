"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { features, home, type Feature } from "@/lib/features";

function Wordmark() {
  // Logo taken from footprintgroup.uk until the official files arrive (see docs/BRAND.md).
  return (
    <Link href="/" className="block">
      <Image
        src="/brand/footprint-logo-white.png"
        alt="Footprint Group"
        width={150}
        height={44}
        priority
      />
      <span className="mt-1 block text-sm font-bold tracking-wide text-white">
        Footprint<span className="text-fp-pink-light">OS</span>
      </span>
    </Link>
  );
}

function NavLink({ feature, active }: { feature: Feature; active: boolean }) {
  const Icon = feature.icon;
  return (
    <Link
      href={feature.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-white/10 text-white"
          : "text-white/65 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon
        size={18}
        className={active ? "text-fp-pink-light" : "text-white/50"}
        aria-hidden
      />
      {feature.label}
    </Link>
  );
}

function Nav({ pathname, visible }: { pathname: string; visible: Feature[] }) {
  const isActive = (f: Feature) =>
    f.href === "/" ? pathname === "/" : pathname.startsWith(f.href);
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      <NavLink feature={home} active={isActive(home)} />
      {visible.length > 0 && <div className="my-2 h-px bg-white/10" />}
      {visible.map((f) => (
        <NavLink key={f.key} feature={f} active={isActive(f)} />
      ))}
    </nav>
  );
}

function UserBox({ name, email }: { name: string; email: string }) {
  return (
    <div className="border-t border-white/10 px-5 py-4">
      <p className="truncate text-sm font-semibold text-white">{name}</p>
      {name !== email && <p className="truncate text-xs text-white/50">{email}</p>}
      <form action="/auth/signout" method="post" className="mt-3">
        <button
          type="submit"
          className="flex items-center gap-2 text-xs font-medium text-white/65 hover:text-white"
        >
          <LogOut size={14} aria-hidden />
          Sign out
        </button>
      </form>
    </div>
  );
}

export default function AppShell({
  children,
  visibleFeatureKeys,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  visibleFeatureKeys: string[];
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const visible = features.filter((f) => visibleFeatureKeys.includes(f.key));

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-fp-black print:hidden lg:flex">
        <div className="bg-fp-gradient h-1" />
        <div className="px-5 py-6">
          <Wordmark />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <Nav pathname={pathname} visible={visible} />
        </div>
        <UserBox name={userName} email={userEmail} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 bg-fp-black print:hidden lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Wordmark />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="rounded-md p-2 text-white hover:bg-white/10"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
        <div className="bg-fp-gradient h-1" />
        {menuOpen && (
          // Close the menu once a link inside it is clicked.
          <div
            id="mobile-nav"
            className="max-h-[80vh] overflow-y-auto pt-2"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
            }}
          >
            <div className="px-3 pb-4">
              <Nav pathname={pathname} visible={visible} />
            </div>
            <UserBox name={userName} email={userEmail} />
          </div>
        )}
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

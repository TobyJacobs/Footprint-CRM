"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { features, home, type Feature } from "@/lib/features";

function Wordmark() {
  // Text wordmark until the official logo files arrive (see docs/BRAND.md).
  return (
    <Link href="/" className="block leading-none text-white">
      <span className="block text-lg font-black tracking-tight">FOOTPRINT</span>
      <span className="block text-[10px] font-semibold tracking-[0.3em] text-white/60">
        PLATFORM
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

function Nav({ pathname }: { pathname: string }) {
  const isActive = (f: Feature) =>
    f.href === "/" ? pathname === "/" : pathname.startsWith(f.href);
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      <NavLink feature={home} active={isActive(home)} />
      <div className="my-2 h-px bg-white/10" />
      {features.map((f) => (
        <NavLink key={f.key} feature={f} active={isActive(f)} />
      ))}
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-fp-black lg:flex">
        <div className="bg-fp-gradient h-1" />
        <div className="px-5 py-6">
          <Wordmark />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <Nav pathname={pathname} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 bg-fp-black lg:hidden">
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
            className="max-h-[80vh] overflow-y-auto px-3 pb-4 pt-2"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
            }}
          >
            <Nav pathname={pathname} />
          </div>
        )}
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

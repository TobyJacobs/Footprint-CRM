import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: { default: "Customer portal", template: "%s · Footprint Group" },
  robots: { index: false, follow: false },
};

// The customer portal's own frame: no staff menu, just the Footprint brand.
export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <div className="flex min-h-screen flex-col bg-fp-offwhite">
      <div className="bg-fp-gradient h-1" />
      <header className="bg-fp-black">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
          <Image src="/brand/footprint-logo-white.png" alt="Footprint Group" width={150} height={44} priority />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

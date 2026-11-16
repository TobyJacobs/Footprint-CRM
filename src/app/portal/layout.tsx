import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Customer portal", template: "%s · Footprint Group" },
  robots: { index: false, follow: false },
};

// The customer portal: no staff menu. Signed-in pages get the portal's own
// side menu ((account)/layout.tsx); sign-in pages a simple branded frame
// ((public)/layout.tsx).
export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return <div className="min-h-screen bg-fp-offwhite">{children}</div>;
}

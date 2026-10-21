import type { Metadata } from "next";
import SectionChrome from "../SectionChrome";

export const metadata: Metadata = { title: "Sales" };

export default function SalesSectionLayout({ children }: { children: React.ReactNode }) {
  return <SectionChrome section="sales">{children}</SectionChrome>;
}

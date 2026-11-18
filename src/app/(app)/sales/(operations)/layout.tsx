import type { Metadata } from "next";
import SectionChrome from "../SectionChrome";

export const metadata: Metadata = { title: "Operations" };

export default function OperationsSectionLayout({ children }: { children: React.ReactNode }) {
  return <SectionChrome section="operations">{children}</SectionChrome>;
}

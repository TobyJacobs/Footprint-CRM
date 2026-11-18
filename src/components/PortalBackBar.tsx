import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPortalSession } from "@/lib/portal";

const sections = {
  quotes: "your quotes",
  orders: "your orders",
  invoices: "your invoices",
  design: "your design work",
} as const;

// On the private quote, document and proof pages: a way back to the customer
// portal for someone signed in to it (owner, 18 November 2026). Nothing shows
// for anyone else, e.g. a customer opening the link from an email.
export default async function PortalBackBar({ section }: { section: keyof typeof sections }) {
  if (!(await getPortalSession())) return null;
  return (
    <div className="bg-fp-black print:hidden">
      <div className="mx-auto flex max-w-[calc(210mm+2rem)] items-center justify-between gap-4 px-4 py-3">
        <Link href={`/portal/${section}`} className="flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          Back to {sections[section]}
        </Link>
        <Link href="/portal" className="text-xs font-bold tracking-wide text-white">
          Customer <span className="text-fp-pink-light">portal</span>
        </Link>
      </div>
    </div>
  );
}

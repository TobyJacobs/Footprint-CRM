import Link from "next/link";
import { Briefcase, FileText, Mail, Megaphone, Newspaper, Phone, Receipt, ShoppingCart, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Action = { href: string | null; label: string; icon: LucideIcon; note?: string };

// Quick actions for one customer, grouped Sell · Work · Contact. Each person
// only sees the actions they're allowed to do; each opens with this customer
// already filled in.
export default function CustomerActions({
  customerId,
  can,
}: {
  customerId: string;
  can: { sales: boolean; projects: boolean; marketing: boolean; customers: boolean };
}) {
  const q = `customer=${customerId}`;
  const groups: { title: string; actions: Action[] }[] = [
    {
      title: "Sell",
      actions: can.sales
        ? [
            { href: `/sales/opportunity?${q}`, label: "New opportunity", icon: FileText },
            { href: `/sales/new?type=sales_order&${q}`, label: "New sales order", icon: ShoppingCart },
            { href: `/sales/new?type=invoice&${q}`, label: "New invoice", icon: Receipt },
            // Advert bookings arrive with Magazines (Wave 5); until then this is a placeholder.
            { href: null, label: "Sell ads", icon: Newspaper, note: "Coming with Magazines" },
          ]
        : [],
    },
    {
      title: "Work",
      actions: [
        ...(can.projects ? [{ href: `/projects/new?${q}`, label: "New project", icon: Briefcase }] : []),
        // Design jobs are started from a project, not from the customer.
        ...(can.marketing ? [{ href: `/marketing/content/new?${q}`, label: "New content item", icon: Megaphone }] : []),
      ],
    },
    {
      title: "Contact",
      actions: can.customers
        ? [
            { href: `/customers/${customerId}#email`, label: "Email customer", icon: Mail },
            { href: `/customers/${customerId}?log=call#timeline`, label: "Log a call", icon: Phone },
            { href: `/customers/${customerId}/contacts/new`, label: "Add contact", icon: UserPlus },
          ]
        : [],
    },
  ].filter((g) => g.actions.length > 0);

  if (groups.length === 0) return null;

  return (
    <nav aria-label="Customer actions" className="mb-6 flex flex-wrap gap-x-6 gap-y-3 rounded-lg border border-fp-border bg-white p-4">
      {groups.map((g) => (
        <div key={g.title} className="flex flex-wrap items-center gap-2">
          <span className="w-full text-xs font-bold uppercase tracking-wide text-fp-mid sm:w-auto">{g.title}</span>
          {g.actions.map((a) =>
            a.href ? (
              <Link
                key={a.label}
                href={a.href}
                className="inline-flex items-center gap-1.5 rounded-md border border-fp-border bg-white px-3 py-1.5 text-sm font-semibold hover:border-fp-pink/40 hover:bg-fp-light"
              >
                <a.icon size={14} aria-hidden className="text-fp-pink" /> {a.label}
              </Link>
            ) : (
              <span
                key={a.label}
                title={a.note}
                aria-disabled="true"
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-dashed border-fp-border px-3 py-1.5 text-sm font-semibold text-fp-mid"
              >
                <a.icon size={14} aria-hidden /> {a.label}
                {a.note && <span className="text-xs font-normal">({a.note})</span>}
              </span>
            ),
          )}
        </div>
      ))}
    </nav>
  );
}

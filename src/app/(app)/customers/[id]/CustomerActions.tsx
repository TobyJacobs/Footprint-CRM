import Link from "next/link";
import { Briefcase, ChevronDown, FileText, Mail, Megaphone, MessageSquare, Phone, Receipt, ShoppingCart, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Action = { href: string; label: string; icon: LucideIcon };

const button =
  "inline-flex items-center gap-1.5 rounded-md border border-fp-border bg-white px-3 py-1.5 text-sm font-semibold hover:border-fp-pink/40 hover:bg-fp-light";

// Quick actions for one customer, grouped Sell · Work · Contact. Each person
// only sees the actions they're allowed to do; each opens with this customer
// already filled in. Kept short (DJ, 9 November 2026): one "New quote" (the
// quote form asks which kind), and the contact actions in one dropdown.
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
            { href: `/sales/new?type=quote&${q}`, label: "New quote", icon: FileText },
            { href: `/sales/new?type=sales_order&${q}`, label: "New sales order", icon: ShoppingCart },
            { href: `/sales/new?type=invoice&${q}`, label: "New invoice", icon: Receipt },
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
  ].filter((g) => g.actions.length > 0);
  const contact: Action[] = can.customers
    ? [
        { href: `/customers/${customerId}#email`, label: "Email customer", icon: Mail },
        { href: `/customers/${customerId}?log=call#timeline`, label: "Log a call", icon: Phone },
        { href: `/customers/${customerId}/contacts/new`, label: "Add contact", icon: UserPlus },
      ]
    : [];

  if (groups.length === 0 && contact.length === 0) return null;

  return (
    <nav aria-label="Customer actions" className="mb-6 flex flex-wrap gap-x-6 gap-y-3 rounded-lg border border-fp-border bg-white p-4">
      {groups.map((g) => (
        <div key={g.title} className="flex flex-wrap items-center gap-2">
          <span className="w-full text-xs font-bold uppercase tracking-wide text-fp-mid sm:w-auto">{g.title}</span>
          {g.actions.map((a) => (
            <Link key={a.label} href={a.href} className={button}>
              <a.icon size={14} aria-hidden className="text-fp-pink" /> {a.label}
            </Link>
          ))}
        </div>
      ))}
      {contact.length > 0 && (
        <details className="group relative">
          <summary className={`${button} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            <MessageSquare size={14} aria-hidden className="text-fp-pink" /> Contact
            <ChevronDown size={14} aria-hidden className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="absolute left-0 z-20 mt-1 min-w-48 rounded-md border border-fp-border bg-white py-1 shadow-lg">
            {contact.map((a) => (
              <li key={a.label}>
                <Link href={a.href} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold hover:bg-fp-light">
                  <a.icon size={14} aria-hidden className="text-fp-pink" /> {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </nav>
  );
}

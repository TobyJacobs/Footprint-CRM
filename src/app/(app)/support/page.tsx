import type { Metadata } from "next";
import Link from "next/link";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { shortDateTime } from "@/lib/customers/display";
import { ticketKindLabel, ticketNumber, ticketStatusLabel, ticketTone } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customer support" };

const filters = [
  { key: "open", label: "Open", statuses: ["new", "in_progress"] },
  { key: "new", label: "New", statuses: ["new"] },
  { key: "in_progress", label: "In progress", statuses: ["in_progress"] },
  { key: "done", label: "Done", statuses: ["done"] },
  { key: "all", label: "All", statuses: ["new", "in_progress", "done"] },
];

type Row = {
  id: string;
  number: number;
  kind: string;
  subject: string;
  status: string;
  contact_name: string | null;
  contact_email: string;
  last_message_at: string;
  customers: { id: string; name: string } | null;
};

// Messages customers send from their portal: change requests and questions.
export default async function SupportPage(props: PageProps<"/support">) {
  const user = await getCurrentUser();
  if (!user.can("support", "view")) return <NoAccess title="Customer support" />;
  const sp = await props.searchParams;
  const filter = filters.find((f) => f.key === sp.show) ?? filters[0];
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("id, number, kind, subject, status, contact_name, contact_email, last_message_at, customers(id, name)")
    .in("status", filter.statuses)
    .order("last_message_at", { ascending: false })
    .limit(300);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Customer support" intro="Change requests and questions customers send from their portal. Reply here and they'll see it in their portal and get an email." />
      <div className="px-6 py-8 lg:px-10">
        <nav aria-label="Show" className="mb-4 flex flex-wrap gap-2 text-sm">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={f.key === "open" ? "/support" : `/support?show=${f.key}`}
              aria-current={f.key === filter.key ? "page" : undefined}
              className={`rounded-full border px-3 py-1 font-semibold ${
                f.key === filter.key ? "border-fp-pink bg-fp-pink text-white" : "border-fp-border bg-white hover:border-fp-pink"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <p className="text-sm text-fp-dark/75">Nothing here.</p>
        ) : (
          <ul className="max-w-4xl divide-y divide-fp-border rounded-lg border border-fp-border bg-white text-sm">
            {rows.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/support/${t.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                    {t.subject}
                  </Link>
                  <p className="text-xs text-fp-mid">
                    {ticketNumber(t.number)} · {ticketKindLabel(t.kind)} · {t.customers?.name ?? "Unknown customer"} · {t.contact_name ?? t.contact_email} · last
                    message {shortDateTime(t.last_message_at)}
                  </p>
                </div>
                <Badge tone={ticketTone(t.status)}>{ticketStatusLabel(t.status)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

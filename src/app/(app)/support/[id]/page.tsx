import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Badge, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { shortDateTime } from "@/lib/customers/display";
import { ticketKindLabel, ticketNumber, ticketStatusLabel, ticketTone } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { replyToCustomer, setSupportStatus } from "../actions";

export const metadata: Metadata = { title: "Support conversation" };

// One support conversation: the messages, a reply box and the status.
export default async function SupportTicketPage(props: PageProps<"/support/[id]">) {
  const user = await getCurrentUser();
  if (!user.can("support", "view")) return <NoAccess title="Customer support" />;
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id, number, kind, subject, status, contact_name, contact_email, created_at, customers(id, name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("support_messages").select("id, from_customer, body, created_at, profiles(full_name, email)").eq("ticket_id", id).order("created_at"),
  ]);
  if (!ticket) notFound();
  const customer = ticket.customers as unknown as { id: string; name: string } | null;
  const canEdit = user.can("support", "edit");

  return (
    <>
      <PageHeader title={ticket.subject} intro={`${ticketNumber(ticket.number)} · ${ticketKindLabel(ticket.kind)} · started ${shortDateTime(ticket.created_at)}`} />
      <div className="grid gap-6 px-6 py-8 lg:grid-cols-[1fr_18rem] lg:px-10">
        <div className="grid content-start gap-4">
          <Link href="/support" className="text-sm font-semibold text-fp-teal-deep hover:underline">
            ← All support messages
          </Link>
          <Notice searchParams={sp} />
          {sp.replied && (
            <p role="status" className="rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
              {sp.replied === "1"
                ? "Reply sent. The customer can see it in their portal and has been emailed."
                : "Reply saved and visible in their portal, but the email to the customer didn't send."}
            </p>
          )}
          <ol className="grid gap-3">
            {(messages ?? []).map((m) => {
              const author = m.profiles as unknown as { full_name: string | null; email: string } | null;
              return (
                <li
                  key={m.id}
                  className={`max-w-[85%] rounded-lg p-4 text-sm ${
                    m.from_customer ? "justify-self-start border border-fp-border bg-white" : "justify-self-end bg-fp-teal/10"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold text-fp-mid">
                    {m.from_customer ? (ticket.contact_name ?? ticket.contact_email) : (author?.full_name ?? author?.email ?? "Footprint")} ·{" "}
                    {shortDateTime(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </li>
              );
            })}
          </ol>
          {canEdit && (
            <form action={replyToCustomer.bind(null, ticket.id)} className="grid gap-3 rounded-lg border border-fp-border bg-white p-4">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Reply to the customer</span>
                <textarea name="body" required rows={5} maxLength={5000} className={inputClass} />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="submit" className={primaryButton}>
                  Send reply
                </button>
                <button type="submit" name="status" value="done" className={secondaryButton}>
                  Send and mark done
                </button>
              </div>
            </form>
          )}
        </div>

        <aside className="grid content-start gap-4 text-sm">
          <section className="rounded-lg border border-fp-border bg-white p-4">
            <h2 className="mb-2 font-bold">Status</h2>
            <Badge tone={ticketTone(ticket.status)}>{ticketStatusLabel(ticket.status)}</Badge>
            {canEdit && (
              <form action={setSupportStatus.bind(null, ticket.id)} className="mt-3 flex flex-wrap gap-2">
                <select name="status" defaultValue={ticket.status} aria-label="Status" className={`${inputClass} w-auto`}>
                  <option value="new">New</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
                <button type="submit" className={secondaryButton}>
                  Save
                </button>
              </form>
            )}
          </section>
          <section className="rounded-lg border border-fp-border bg-white p-4">
            <h2 className="mb-2 font-bold">From</h2>
            <p>{ticket.contact_name ?? "—"}</p>
            <p>
              <a href={`mailto:${ticket.contact_email}`} className="text-fp-teal-deep hover:underline">
                {ticket.contact_email}
              </a>
            </p>
            {customer && (
              <p className="mt-2">
                <Link href={`/customers/${customer.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                  {customer.name}
                </Link>
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

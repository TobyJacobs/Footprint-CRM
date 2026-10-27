import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, inputClass, primaryButton } from "@/components/ui";
import { shortDateTime } from "@/lib/customers/display";
import { getPortalSession, getPortalTicket, ticketKindLabel, ticketNumber, ticketStatusLabel, ticketTone } from "@/lib/portal";
import { replyToSupportTicket } from "../../actions";

export const metadata: Metadata = { title: "Your message" };

// One of the customer's support conversations: everything said so far, and a
// box to write again.
export default async function PortalTicketPage(props: PageProps<"/portal/support/[id]">) {
  if (!(await getPortalSession())) redirect("/portal/login");
  const { id } = await props.params;
  const ticket = await getPortalTicket(id);
  if (!ticket) notFound();
  const { error, sent } = await props.searchParams;

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div>
        <Link href="/portal#support" className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to your portal
        </Link>
        <h1 className="mt-2 text-2xl font-black">{ticket.subject}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-fp-dark/75">
          {ticketNumber(ticket.number)} · {ticketKindLabel(ticket.kind)} · {ticket.customer_name}
          <Badge tone={ticketTone(ticket.status)}>{ticketStatusLabel(ticket.status)}</Badge>
        </p>
      </div>

      {typeof error === "string" ? (
        <p role="alert" className="rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-sm text-fp-error">
          {error}
        </p>
      ) : (
        sent && (
          <p role="status" className="rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
            Thanks, your message has been sent. We&apos;ll reply here and email you when we do.
          </p>
        )
      )}

      <ol className="grid gap-3">
        {ticket.messages.map((m, i) => (
          <li
            key={i}
            className={`max-w-[85%] rounded-lg p-4 text-sm ${
              m.from_customer ? "justify-self-end bg-fp-pink/10" : "justify-self-start border border-fp-border bg-white"
            }`}
          >
            <p className="mb-1 text-xs font-semibold text-fp-mid">
              {m.from_customer ? "You" : `${m.author} at Footprint`} · {shortDateTime(m.created_at)}
            </p>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>

      <form action={replyToSupportTicket.bind(null, ticket.id)} className="grid gap-3 rounded-lg border border-fp-border bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">{ticket.status === "done" ? "Need anything else? Writing again reopens this." : "Add a message"}</span>
          <textarea name="body" required rows={4} maxLength={5000} className={inputClass} />
        </label>
        <button type="submit" className={`${primaryButton} justify-self-start`}>
          Send
        </button>
      </form>
    </div>
  );
}

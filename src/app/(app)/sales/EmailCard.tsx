import { Mail } from "lucide-react";
import { Badge, Card, Field, inputClass, primaryButton } from "@/components/ui";
import { isEmailConfigured, isEmailTestMode } from "@/lib/email/postmark";
import { shortDateTime } from "@/lib/customers/display";
import { docTypes, type DocType } from "@/lib/sales/options";
import { sendDocumentEmail } from "./email-actions";

type LogRow = { id: string; to_addresses: string; subject: string; status: string; error: string | null; sent_at: string };

// "Email to customer" box on a document page, with the history of emails sent.
export default function EmailCard({
  documentId,
  type,
  number,
  total,
  dueDate,
  contactEmail,
  contactFirstName,
  senderName,
  companyName,
  log,
}: {
  documentId: string;
  type: DocType;
  number: string;
  total: string;
  dueDate: string | null;
  contactEmail: string | null;
  contactFirstName: string | null;
  senderName: string;
  companyName: string;
  log: LogRow[];
}) {
  const label = docTypes[type].label;
  const greeting = contactFirstName ? `Hi ${contactFirstName},` : "Hello,";
  const middle =
    type === "quote"
      ? `Please find your quote ${number} for ${total} below. You can view it and accept it online using the link.`
      : type === "invoice"
        ? `Please find invoice ${number} for ${total}${dueDate ? `, due by ${dueDate}` : ""}. You can view and print it using the link.`
        : type === "credit_note"
          ? `Please find credit note ${number} for ${total}. You can view and print it using the link.`
          : `Thank you for your order. Your order confirmation ${number} (${total}) is available using the link.`;
  const message = `${greeting}\n\n${middle}\n\nIf you have any questions, just reply to this email.\n\nKind regards,\n${senderName}\n${companyName}`;
  const configured = isEmailConfigured();

  return (
    <Card title="Email to customer">
      {!configured ? (
        <p className="text-sm text-fp-dark/75">
          Email isn&apos;t switched on yet. Once Postmark is set up, you&apos;ll be able to send {label.toLowerCase()}s from here.
        </p>
      ) : (
        <form action={sendDocumentEmail.bind(null, documentId)} className="grid gap-3">
          {isEmailTestMode() && (
            <p className="rounded-md bg-fp-amber/15 px-3 py-2 text-xs">
              Test mode: emails are accepted by Postmark but <strong>not delivered</strong>.
            </p>
          )}
          <Field label="To">
            <input name="to" type="text" defaultValue={contactEmail ?? ""} required className={inputClass} placeholder="name@example.com" />
          </Field>
          <Field label="CC (optional)">
            <input name="cc" type="text" className={inputClass} placeholder="Separate several with commas" />
          </Field>
          <Field label="Subject">
            <input name="subject" defaultValue={`${label} ${number} from ${companyName}`} required className={inputClass} />
          </Field>
          <Field label="Message" hint="A secure link to the document is added automatically.">
            <textarea name="message" rows={8} defaultValue={message} required className={inputClass} />
          </Field>
          <div>
            <button type="submit" className={`${primaryButton} inline-flex items-center gap-2`}>
              <Mail size={14} aria-hidden /> Send email
            </button>
          </div>
        </form>
      )}

      {log.length > 0 && (
        <div className="mt-5 border-t border-fp-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fp-mid">Sent</p>
          <ul className="grid gap-2 text-sm">
            {log.map((e) => (
              <li key={e.id}>
                <span className="mr-2">
                  <Badge tone={e.status === "failed" ? "red" : e.status === "test" ? "amber" : "teal"}>
                    {e.status === "test" ? "Test" : e.status === "failed" ? "Failed" : "Sent"}
                  </Badge>
                </span>
                {shortDateTime(e.sent_at)} to {e.to_addresses}
                {e.error && <span className="block text-xs text-fp-error">{e.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

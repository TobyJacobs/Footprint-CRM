import { Send } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import CopyButton from "@/components/CopyButton";
import { Badge, Card, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { shortDateTime } from "@/lib/customers/display";
import { isEmailConfigured, isEmailTestMode } from "@/lib/email/sendgrid";
import { APPROVAL_LINK_DAYS, approvalStatusLabel, isPast, jobNumber } from "@/lib/design/options";
import { sendProofForApproval, withdrawApproval } from "../actions";

export type ApprovalRow = {
  id: string;
  token: string;
  version: number | null;
  sent_to: string;
  status: string;
  expires_at: string;
  created_at: string;
  response_name: string | null;
  response_note: string | null;
  responded_at: string | null;
};

const tone = (s: string) => (s === "approved" ? "teal" : s === "changes" ? "pink" : s === "waiting" ? "amber" : "grey");

// "Customer approval" box on a design job: send the latest proof to the
// customer with a private link, and see every link sent and its answer.
export default function ApprovalCard({
  jobId,
  jobNumber: number,
  jobTitle,
  latestVersion,
  canEdit,
  contactEmail,
  contactFirstName,
  senderName,
  companyName,
  origin,
  approvals,
}: {
  jobId: string;
  jobNumber: number;
  jobTitle: string;
  latestVersion: number | null;
  canEdit: boolean;
  contactEmail: string | null;
  contactFirstName: string | null;
  senderName: string;
  companyName: string;
  origin: string;
  approvals: ApprovalRow[];
}) {
  const configured = isEmailConfigured();
  const greeting = contactFirstName ? `Hi ${contactFirstName},` : "Hello,";
  const message = `${greeting}\n\nYour proof for "${jobTitle}" is ready to check. Please open the link to see it, then approve it or let us know what you'd like changed.\n\nIf you have any questions, just reply to this email.\n\nKind regards,\n${senderName}\n${companyName}`;

  return (
    <section id="approval">
      <Card title="Customer approval">
        {canEdit && latestVersion !== null && (
          <form action={sendProofForApproval.bind(null, jobId)} className="mb-5 grid gap-3">
            <p className="text-sm text-fp-dark/75">
              Sends proof <strong>v{latestVersion}</strong> with a private link where the customer can approve it or ask for changes. The link works for {APPROVAL_LINK_DAYS} days. Any older link for this job stops working.
            </p>
            {configured ? (
              <>
                {isEmailTestMode() && (
                  <p className="rounded-md bg-fp-amber/15 px-3 py-2 text-xs">
                    Test mode: emails are accepted by SendGrid but <strong>not delivered</strong>.
                  </p>
                )}
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Send to</span>
                  <input name="to" type="text" defaultValue={contactEmail ?? ""} placeholder="name@example.com (separate several with commas)" className={inputClass} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Subject</span>
                  <input name="subject" defaultValue={`Your proof to approve: ${jobTitle} (${jobNumber(number)})`} className={inputClass} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Message</span>
                  <textarea name="message" rows={8} defaultValue={message} className={inputClass} />
                </label>
              </>
            ) : (
              <p className="text-sm text-fp-dark/75">Email isn&apos;t switched on yet, but you can make a link and paste it into your own email.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {configured && (
                <button type="submit" name="mode" value="email" className={`${primaryButton} inline-flex items-center gap-2`}>
                  <Send size={14} aria-hidden /> Email proof for approval
                </button>
              )}
              <button type="submit" name="mode" value="link" formNoValidate className={secondaryButton}>
                Just make a link
              </button>
            </div>
          </form>
        )}
        {canEdit && latestVersion === null && <p className="mb-4 text-sm text-fp-mid">Upload a proof to send it to the customer for approval.</p>}

        {approvals.length > 0 ? (
          <ul className="grid gap-3 text-sm">
            {approvals.map((a) => {
              const live = a.status === "waiting" && !isPast(a.expires_at);
              const link = `${origin}/p/${a.token}`;
              return (
                <li key={a.id} className="rounded-md border border-fp-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>
                      <strong>v{a.version ?? "?"}</strong> · {a.sent_to} · {shortDateTime(a.created_at)}
                    </p>
                    <Badge tone={tone(a.status)}>{a.status === "waiting" && !live ? "Link expired" : approvalStatusLabel[a.status] ?? a.status}</Badge>
                  </div>
                  {a.responded_at && (
                    <p className="mt-1 text-xs text-fp-mid">
                      Answered by {a.response_name} on {shortDateTime(a.responded_at)}
                    </p>
                  )}
                  {a.response_note && <p className="mt-2 whitespace-pre-line rounded-md bg-fp-offwhite p-2">{a.response_note}</p>}
                  {live && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <CopyButton text={link} label="Copy link" />
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-fp-teal-deep hover:underline">
                        See what the customer sees
                      </a>
                      {canEdit && (
                        <form action={withdrawApproval.bind(null, jobId, a.id)} className="ml-auto">
                          <ConfirmSubmit message="Stop this link working? The customer won't be able to answer it." className="text-xs font-semibold text-fp-error hover:underline">
                            Withdraw link
                          </ConfirmSubmit>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-fp-mid">Nothing sent to the customer yet.</p>
        )}
      </Card>
    </section>
  );
}

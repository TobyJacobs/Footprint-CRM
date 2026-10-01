import { ShieldCheck } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Card, dangerButton, secondaryButton } from "@/components/ui";
import { longDate } from "@/lib/customers/display";

// UK GDPR tools, shown to admins only: export everything we hold (subject
// access request) and erase on request (right to erasure).
export default function DataProtectionCard({
  subject,
  kind,
  exportHref,
  eraseAction,
  erasedAt,
}: {
  subject: string;
  kind: "contact" | "customer";
  exportHref: string;
  eraseAction: (fd: FormData) => Promise<void>;
  erasedAt?: string | null;
}) {
  return (
    <Card title="Data protection (UK GDPR)">
      <div className="grid gap-5 text-sm">
        {erasedAt && (
          <p className="flex items-center gap-2 rounded-md bg-fp-light px-3 py-2">
            <ShieldCheck size={16} className="text-fp-teal-deep" aria-hidden />
            Personal details were erased on {longDate(erasedAt)}.
          </p>
        )}

        <div>
          <p className="font-semibold">Subject access request</p>
          <p className="mb-3 text-fp-dark/75">
            Download everything the platform holds about {kind === "contact" ? "this person" : "this customer and its people"},
            including its change history. Send it securely, within one month of the request.
          </p>
          <a href={exportHref} className={`${secondaryButton} inline-block`}>
            Download data (JSON file)
          </a>
        </div>

        {!erasedAt && (
          <form action={eraseAction} className="border-t border-fp-border pt-5">
            <p className="font-semibold">Erase on request</p>
            <p className="mb-3 text-fp-dark/75">
              {kind === "contact"
                ? "Blanks this person's name and contact details, removes them from mailing lists, and cleans them out of the audit log. The record stays as “Removed (GDPR)” so history still adds up."
                : "Erases every contact at this customer, the timeline, hosting logins and notes, and the customer's own details. The record stays as “Removed customer (GDPR)”."}{" "}
              Records we must keep by law (e.g. invoices for 6 years) are not affected. This can&apos;t be undone.
            </p>
            {kind === "contact" && (
              <label className="mb-3 flex items-center gap-2">
                <input type="checkbox" name="delete_activity" defaultChecked className="accent-fp-pink" />
                Also delete timeline entries linked to this person
              </label>
            )}
            <ConfirmSubmit
              className={dangerButton}
              message={`Permanently erase the personal data for ${subject}? This can't be undone.`}
            >
              Erase {kind === "contact" ? "this person" : "this customer"}
            </ConfirmSubmit>
          </form>
        )}
      </div>
    </Card>
  );
}

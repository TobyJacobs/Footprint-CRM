import { headers } from "next/headers";
import CopyButton from "@/components/CopyButton";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Badge, Card, dangerButton, primaryButton, secondaryButton } from "@/components/ui";
import { shortDateTime } from "@/lib/customers/display";
import { activateStaff, deactivateStaff } from "../actions";

export type StaffAccess = {
  id: string;
  email: string;
  activated: boolean;
  activated_at: string | null;
  invited_at: string | null;
  joined_at: string | null;
  invite_token: string | null;
  account_enabled: boolean;
  in_entra: boolean;
};

export function staffStatus(d: { activated: boolean; joined_at: string | null; account_enabled: boolean; in_entra: boolean }, hasActiveProfile = false) {
  if (!d.in_entra || !d.account_enabled) return "left" as const;
  if (!d.activated) return "not_activated" as const;
  return d.joined_at || hasActiveProfile ? ("active" as const) : ("invited" as const);
}

export function StaffStatusBadge({ status }: { status: ReturnType<typeof staffStatus> }) {
  if (status === "active") return <Badge tone="teal">Active</Badge>;
  if (status === "invited") return <Badge tone="amber">Invited</Badge>;
  if (status === "left") return <Badge tone="red">Off in Microsoft 365</Badge>;
  return <Badge>Not activated</Badge>;
}

// Activate / resend invite / deactivate, plus the invite link to copy.
export default async function StaffAccessCard({
  entry,
  back,
  hasActiveProfile,
  isAdminUser,
  searchParams,
}: {
  entry: StaffAccess;
  back: string;
  hasActiveProfile: boolean;
  isAdminUser: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const status = staffStatus(entry, hasActiveProfile);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const link = entry.invite_token ? `${origin}/invite/${entry.invite_token}` : null;
  const invited = typeof searchParams.invited === "string" ? searchParams.invited : null;

  return (
    <Card title="Access">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <StaffStatusBadge status={status} />
        {status === "not_activated" && <span className="text-fp-dark/75">Can&apos;t use the platform until activated.</span>}
        {status === "invited" && <span className="text-fp-dark/75">Invited {shortDateTime(entry.invited_at)}; hasn&apos;t signed in yet.</span>}
        {status === "active" && <span className="text-fp-dark/75">Using the platform{entry.joined_at ? ` since ${shortDateTime(entry.joined_at)}` : ""}.</span>}
        {status === "left" && <span className="text-fp-dark/75">Their Microsoft 365 account is switched off or removed, so they can&apos;t sign in.</span>}
      </div>

      {invited && (
        <p role="status" className="mb-3 rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-3 py-2 text-sm text-fp-teal-deep">
          {invited === "sent" && "Activated. The invite email has been sent."}
          {invited === "test" && "Activated. Invite email accepted in test mode (not actually delivered): send them the link below."}
          {invited === "nomail" && "Activated. Email isn't set up yet, so send them the invite link below."}
          {invited === "failed" && "Activated, but the invite email couldn't be sent: send them the link below."}
        </p>
      )}

      {status !== "left" && (
        <div className="flex flex-wrap gap-2">
          {status === "not_activated" ? (
            <form action={activateStaff.bind(null, entry.id, back)}>
              <button type="submit" className={primaryButton}>Activate and send invite</button>
            </form>
          ) : (
            <>
              {status === "invited" && (
                <form action={activateStaff.bind(null, entry.id, back)}>
                  <button type="submit" className={secondaryButton}>Resend invite</button>
                </form>
              )}
              {!isAdminUser && (
                <form action={deactivateStaff.bind(null, entry.id, back)}>
                  <ConfirmSubmit className={dangerButton} message={`Deactivate ${entry.email}? They won't be able to use the platform.`}>
                    Deactivate
                  </ConfirmSubmit>
                </form>
              )}
            </>
          )}
        </div>
      )}

      {link && status === "invited" && (
        <div className="mt-4 rounded-md bg-fp-offwhite p-3 text-sm">
          <p className="font-semibold">Invite link</p>
          <p className="mb-2 text-fp-dark/75">Goes to a welcome page where they sign in with their Microsoft work account.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 text-xs">{link}</code>
            <CopyButton text={link} label="Copy link" />
          </div>
        </div>
      )}
      {isAdminUser && status !== "not_activated" && (
        <p className="mt-3 text-xs text-fp-dark/70">Admins can&apos;t be deactivated here: remove their admin rights first.</p>
      )}
    </Card>
  );
}

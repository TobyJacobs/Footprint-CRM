import { requireAdmin } from "@/lib/auth";
import { sendTestError } from "../actions";
import { Card, dangerButton } from "../ui";

export default async function SystemPage() {
  await requireAdmin();
  const alertsOn = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

  return (
    <div className="grid max-w-3xl gap-6">
      <Card title="Error alerts">
        <p className="text-sm text-fp-dark/75">
          When something breaks, it&apos;s reported to Sentry (EU region), which emails the team. No
          personal details are sent.
        </p>
        <p className="mt-3 text-sm">
          Status:{" "}
          {alertsOn ? (
            <span className="font-semibold text-fp-teal-deep">Switched on</span>
          ) : (
            <span className="font-semibold text-fp-error">Switched off (no Sentry setting)</span>
          )}
        </p>
        <form action={sendTestError} className="mt-4">
          <p className="mb-3 text-sm text-fp-dark/75">
            To check alerts are working, send a test error. You&apos;ll see an error page — that&apos;s
            expected — and it should appear in Sentry within a minute.
          </p>
          <button type="submit" className={dangerButton}>
            Send a test error
          </button>
        </form>
      </Card>
    </div>
  );
}

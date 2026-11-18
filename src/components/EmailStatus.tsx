import { Badge } from "@/components/ui";
import { shortDateTime } from "@/lib/customers/display";

export type EmailLogStatus = {
  status: string;
  error?: string | null;
  delivery_status?: string | null;
  delivery_detail?: string | null;
  delivery_at?: string | null;
};

// What happened to a sent email (owner, 9 November 2026): "Sent" only means
// SendGrid accepted it; SendGrid's reports then say whether it reached the
// customer's mail server, was delayed, bounced or was dropped.
export default function EmailStatus({ e }: { e: EmailLogStatus }) {
  if (e.status === "failed") return <Shown tone="red" label="Not sent" detail={e.error} />;
  if (e.status === "test") return <Shown tone="amber" label="Test" detail={e.error} />;
  switch (e.delivery_status) {
    case "delivered":
      return <Shown tone="teal" label="Delivered ✓" detail={e.delivery_at ? `Reached their mail server ${shortDateTime(e.delivery_at)}` : null} />;
    case "deferred":
      return <Shown tone="amber" label="Delayed" detail={e.delivery_detail ?? "Their mail server asked SendGrid to try again later; it will keep trying."} />;
    case "bounced":
      return <Shown tone="red" label="Bounced" detail={e.delivery_detail ?? "Their mail server turned it away. Check the address and send it again."} />;
    case "dropped":
      return <Shown tone="red" label="Not delivered" detail={e.delivery_detail ?? "SendGrid didn't send it (often a bad or unsubscribed address)."} />;
    case "spam":
      return <Shown tone="red" label="Marked as spam" detail={e.delivery_detail} />;
    default:
      return <Shown tone="grey" label="Sent" detail={e.error ?? "Waiting for the delivery report"} />;
  }
}

function Shown({ tone, label, detail }: { tone: "grey" | "teal" | "pink" | "amber" | "red"; label: string; detail?: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <Badge tone={tone}>{label}</Badge>
      {detail && <span className={`text-xs ${tone === "red" ? "text-fp-error" : "text-fp-mid"}`}>{detail}</span>}
    </span>
  );
}

import { docTypes, type DocType } from "./options";

// The standard subject and message for emailing a quote, order, invoice or
// credit note. Used by the email box on a document and by "Send quote".
export function documentEmailText(o: {
  type: DocType;
  label?: string; // e.g. "Proposal" for a proposal quote
  number: string;
  total: string;
  dueDate: string | null;
  contactFirstName: string | null;
  senderName: string;
  companyName: string;
}) {
  const label = o.label ?? docTypes[o.type].label;
  const greeting = o.contactFirstName ? `Hi ${o.contactFirstName},` : "Hello,";
  const middle =
    o.type === "quote"
      ? `Please find your ${label.toLowerCase()} ${o.number} for ${o.total} attached. You can also view it and accept it online using the link.`
      : o.type === "invoice"
        ? `Please find invoice ${o.number} for ${o.total}${o.dueDate ? `, due by ${o.dueDate}` : ""} attached. You can also view it online using the link.`
        : o.type === "credit_note"
          ? `Please find credit note ${o.number} for ${o.total} attached. You can also view it online using the link.`
          : `Thank you for your order. Your order confirmation ${o.number} (${o.total}) is attached, and you can also view it online using the link.`;
  const signOff = `If you have any questions, just reply to this email.\n\nKind regards,\n${o.senderName}\n${o.companyName}`;
  return {
    subject: `${label} ${o.number} from ${o.companyName}`,
    message: `${greeting}\n\n${middle}\n\n${signOff}`,
    resendMessage: `${greeting}\n\nJust a reminder: ${middle.charAt(0).toLowerCase()}${middle.slice(1)}\n\n${signOff}`,
  };
}

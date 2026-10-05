"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";

type Template = { id: string; name: string; subject: string; body: string };
type Contact = { id: string; first_name: string | null; last_name: string; email: string | null };

// Fill in a template's {{placeholders}} for this customer and contact.
function fill(text: string, values: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => values[key] ?? whole);
}

// Draft an email to a customer from a template, edit it, then send it from the
// platform (logged on the customer's timeline) or open it in your own email.
export default function EmailComposer({
  templates,
  contacts,
  companyName,
  ourCompany,
  senderName,
  canSend,
  sendAction,
}: {
  templates: Template[];
  contacts: Contact[];
  companyName: string;
  ourCompany: string;
  senderName: string;
  canSend: boolean;
  sendAction: (fd: FormData) => Promise<void>;
}) {
  const withEmail = contacts.filter((c) => c.email);
  const [templateId, setTemplateId] = useState("");
  const [contactId, setContactId] = useState(withEmail[0]?.id ?? "");
  const [to, setTo] = useState(withEmail[0]?.email ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const values = (cid: string): Record<string, string> => {
    const c = contacts.find((x) => x.id === cid);
    return {
      first_name: c?.first_name || "there",
      company_name: companyName,
      sender_name: senderName,
      our_company: ourCompany,
    };
  };

  const applyTemplate = (tid: string, cid: string) => {
    const t = templates.find((x) => x.id === tid);
    if (!t) {
      setSubject("");
      setBody("");
      return;
    }
    const v = values(cid);
    setSubject(fill(t.subject, v));
    setBody(fill(t.body, v));
  };

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <form action={sendAction} className="grid gap-3 text-sm">
      <label className="grid gap-1">
        <span className="font-semibold">Template</span>
        <select
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
            applyTemplate(e.target.value, contactId);
          }}
          className={inputClass}
        >
          <option value="">Choose a template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {templateId && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="font-semibold">To (contact)</span>
              <select
                value={contactId}
                onChange={(e) => {
                  setContactId(e.target.value);
                  const c = contacts.find((x) => x.id === e.target.value);
                  setTo(c?.email ?? "");
                  applyTemplate(templateId, e.target.value);
                }}
                className={inputClass}
              >
                <option value="">Type an address instead</option>
                {withEmail.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">Email address</span>
              <input name="to" value={to} onChange={(e) => setTo(e.target.value)} required className={inputClass} placeholder="name@example.com" />
            </label>
          </div>
          <label className="grid gap-1">
            <span className="font-semibold">Subject</span>
            <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required className={inputClass} />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">Message</span>
            <textarea name="message" value={body} onChange={(e) => setBody(e.target.value)} rows={12} required className={inputClass} />
            <span className="text-xs text-fp-mid">Read it through and edit anything before sending.</span>
          </label>
          <input type="hidden" name="contact_id" value={contactId} />
          <div className="flex flex-wrap gap-2">
            {canSend && (
              <button type="submit" className={`${primaryButton} inline-flex items-center gap-2`}>
                <Mail size={14} aria-hidden /> Send email
              </button>
            )}
            <a href={mailto} className={secondaryButton}>
              Open in my email app
            </a>
          </div>
        </>
      )}
    </form>
  );
}

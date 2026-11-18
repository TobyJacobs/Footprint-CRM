import "server-only";
import { createPublicKey, verify } from "node:crypto";

// SendGrid's signed Event Webhook (see app/api/email-events). SendGrid signs
// each report with its private key; we check it with the public
// "verification key" from SendGrid → Mail Settings → Event Webhook, kept in
// the SENDGRID_WEBHOOK_KEY Netlify setting. Unsigned or tampered reports are
// refused.
export function verifySendGridSignature(publicKey: string, payload: string, signature: string, timestamp: string) {
  try {
    const key = createPublicKey({
      key: `-----BEGIN PUBLIC KEY-----\n${publicKey.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----\n`,
      format: "pem",
    });
    return verify("sha256", Buffer.from(timestamp + payload), key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

export type SendGridEvent = { event?: string; sg_message_id?: string; email?: string; reason?: string; response?: string; type?: string; timestamp?: number };

// What to show staff about an event (the receiving server's own words, cut short).
export const eventDetail = (e: SendGridEvent) => (e.reason || e.response || e.type || "").replace(/\s+/g, " ").trim().slice(0, 500);

import "server-only";
import { createHmac } from "node:crypto";
import { isSafeWebhookUrl } from "./bot-tools";

// Bots that live outside FootprintOS (owner, 18 November 2026). When an
// outside bot has a web address, FootprintOS sends it the request (or the
// group chat so far) and shows its reply. Each message is signed with the
// bot's own signing secret so the bot can check it really came from us. The
// secret is worked out from PORTAL_LINK_KEY (in Netlify) and the bot's id,
// so nothing secret is stored in the database.

export function signingSecret(botId: string): string | null {
  const key = process.env.PORTAL_LINK_KEY;
  if (!key) return null;
  return createHmac("sha256", key).update(`control-room-webhook:${botId}`).digest("hex");
}

export async function callOutsideBot(bot: { id: string; webhook_url: string | null }, payload: Record<string, unknown>): Promise<string> {
  if (!bot.webhook_url || !isSafeWebhookUrl(bot.webhook_url)) throw new Error("This bot has no usable web address");
  const secret = signingSecret(bot.id);
  if (!secret) throw new Error("FootprintOS's signing key isn't set up in Netlify");
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const res = await fetch(bot.webhook_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "FootprintOS-control-room",
      "X-FootprintOS-Timestamp": timestamp,
      "X-FootprintOS-Signature": `sha256=${signature}`,
    },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`The bot's address answered ${res.status}`);
  const text = (await res.text()).slice(0, 100_000);
  let reply: unknown;
  try {
    reply = (JSON.parse(text) as { reply?: unknown }).reply;
  } catch {
    throw new Error("The bot's answer wasn't JSON with a reply");
  }
  if (typeof reply !== "string" || !reply.trim()) throw new Error("The bot's answer had no reply");
  return reply.trim().slice(0, 8000);
}

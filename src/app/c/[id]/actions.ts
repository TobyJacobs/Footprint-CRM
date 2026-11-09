"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { askBot, botConfigured, type BotTurn } from "@/lib/chat-bot";
import { sendEmail } from "@/lib/email/sendgrid";
import { PUBLIC_ID_RE } from "@/lib/lead-forms";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

// The website chat (see the website_chat migration). The visitor's browser
// keeps a random code (`visitor`); FootprintOS passes it, with the secret
// key, to the database. Public replies are only our own plain messages.

export type ChatMessage = { role: "visitor" | "bot"; body: string };
export type ChatState = { status: "new" | "bot" | "handover" | "closed"; hasDetails: boolean; messages: ChatMessage[]; error?: string };

const VISITOR_RE = /^[0-9a-f]{32,64}$/;
const SORRY = "Sorry, the chat isn't working right now. Please use our contact form or email us instead.";
const HANDOVER =
  "Thanks for your message. A member of the team will get back to you: just leave your name, email and phone below.";
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function ipHash(key: string) {
  const h = await headers();
  const ip = h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return ip ? createHash("sha256").update(`${key}:${ip}`).digest("hex") : null;
}

async function history(key: string, publicId: string, visitor: string): Promise<ChatState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_history", { p_key: key, p_public_id: publicId, p_visitor: visitor });
  if (error || !data) return { status: "new", hasDetails: false, messages: [], error: SORRY };
  const d = data as { status: ChatState["status"]; has_details: boolean; messages: ChatMessage[] };
  return { status: d.status, hasDetails: d.has_details, messages: d.messages };
}

export async function loadChat(publicId: string, visitor: string): Promise<ChatState> {
  const key = process.env.PORTAL_LINK_KEY;
  if (!key || !PUBLIC_ID_RE.test(publicId) || !VISITOR_RE.test(visitor)) return { status: "new", hasDetails: false, messages: [], error: SORRY };
  return history(key, publicId, visitor);
}

// The visitor sends a message: the bot answers it, or the chat is handed
// over so they can leave their details.
export async function sendChat(publicId: string, visitor: string, text: string, page: string): Promise<ChatState> {
  const key = process.env.PORTAL_LINK_KEY;
  if (!key || !PUBLIC_ID_RE.test(publicId) || !VISITOR_RE.test(visitor)) return { status: "new", hasDetails: false, messages: [], error: SORRY };
  const body = text.trim().slice(0, 1000);
  if (!body) return history(key, publicId, visitor);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_visitor_message", {
    p_key: key,
    p_public_id: publicId,
    p_visitor: visitor,
    p_body: body,
    p_page: page.slice(0, 300),
    p_ip_hash: await ipHash(key),
  });
  if (error || !data) {
    const shown: Record<string, string> = {
      "Too many messages": "Thanks, that's a lot of messages! Please leave your details or try again a bit later.",
      "This chat is closed": "Sorry, this chat is closed at the moment.",
    };
    if (!shown[error?.message ?? ""]) console.error("Website chat refused:", error?.message);
    return { ...(await history(key, publicId, visitor)), error: shown[error?.message ?? ""] ?? SORRY };
  }
  const m = data as { conversation_id: string; status: string; has_details: boolean; bot_enabled: boolean; site_name: string; knowledge: string; history: BotTurn[] };
  const reply = (role: "bot" | "system", text: string, handover: boolean) =>
    supabase.rpc("chat_reply", { p_key: key, p_conversation: m.conversation_id, p_role: role, p_body: text, p_handover: handover });

  if (m.status === "handover") {
    // Already with the team: keep the message for them.
    if (m.has_details) await reply("bot", "Thanks, I've added that to your chat for the team.", false);
  } else if (m.bot_enabled && botConfigured()) {
    const answer = await askBot(m.site_name, m.knowledge, m.history);
    if (answer) await reply("bot", answer.reply, answer.handover);
    else {
      await reply("system", "The bot couldn't answer (Grok didn't reply), so the chat was handed over.", false);
      await reply("bot", HANDOVER, true);
    }
  } else {
    await reply("bot", HANDOVER, true);
  }
  return history(key, publicId, visitor);
}

// The visitor leaves their name, email and phone: a lead is made (or added
// to) and the chat is emailed to the chat box's chosen people.
export async function sendChatDetails(publicId: string, visitor: string, name: string, email: string, phone: string): Promise<ChatState> {
  const key = process.env.PORTAL_LINK_KEY;
  if (!key || !PUBLIC_ID_RE.test(publicId) || !VISITOR_RE.test(visitor)) return { status: "new", hasDetails: false, messages: [], error: SORRY };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_handover", {
    p_key: key,
    p_public_id: publicId,
    p_visitor: visitor,
    p_name: name.slice(0, 200),
    p_email: email.slice(0, 320),
    p_phone: phone.slice(0, 50),
  });
  if (error || !data) {
    const shown: Record<string, string> = {
      "Please give your name and a valid email address": "Please give your name and a valid email address.",
      "Already sent": "Thanks, the team already has your details.",
    };
    if (!shown[error?.message ?? ""]) console.error("Website chat details refused:", error?.message);
    return { ...(await history(key, publicId, visitor)), error: shown[error?.message ?? ""] ?? SORRY };
  }

  const r = data as { conversation_id: string; lead_id: string; pipeline_id: string; widget_name: string; repeat: boolean; page: string | null; chat: string; notify: string[] };
  if (r.notify.length) {
    const lines = [`Name: ${name}`, `Email: ${email}`, phone && `Phone: ${phone}`, r.page && `From: ${r.page}`].filter(Boolean) as string[];
    const site = await siteUrl();
    const link = `${site}/leads?p=${r.pipeline_id}&open=${r.lead_id}`;
    const chatLink = `${site}/support/chat?c=${r.conversation_id}`;
    const intro = `${name} needs a person in the "${r.widget_name}" chat. ${r.repeat ? "It's been added to their open lead." : "It's a new lead in FootprintOS."}`;
    const sent = await sendEmail({
      to: r.notify.join(", "),
      subject: `Website chat: ${name}`.slice(0, 150),
      text: `${intro}\n\n${lines.join("\n")}\n\nThe chat:\n${r.chat}\n\nOpen the chat in Customer support: ${chatLink}\nOpen the lead: ${link}`,
      html: `<p>${escapeHtml(intro)}</p><p>${lines.map(escapeHtml).join("<br>")}</p><p><strong>The chat:</strong></p><p style="white-space:pre-wrap">${escapeHtml(r.chat)}</p><p><a href="${chatLink}">Open the chat in Customer support</a> · <a href="${link}">Open the lead</a></p>`,
      replyTo: email,
      tag: "website-chat",
    });
    if (!sent.ok) console.error("Website chat email failed:", sent.error);
  }
  return history(key, publicId, visitor);
}

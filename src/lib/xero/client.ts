import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

// Talking to Xero (https://developer.xero.com). Settings, in Netlify only:
//   XERO_CLIENT_ID      - from the Footprint app in Xero's developer portal
//   XERO_CLIENT_SECRET  - secret; also used to make the key below
//   XERO_SCOPES         - optional; the permissions to ask Xero for
// An admin connects once (Admin → Xero). The Xero sign-in (tokens) is kept in
// the database encrypted with a key made from the client secret, and only the
// server, giving the key, can fetch it.

export const isXeroConfigured = () => Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);

export const XERO_SCOPES =
  process.env.XERO_SCOPES ??
  "openid profile email offline_access accounting.invoices accounting.contacts accounting.settings.read accounting.payments.read";

// The key the server gives the database (its fingerprint is stored there), and
// the encryption key for the tokens. Both come from the client secret.
const derive = (label: string) => createHmac("sha256", process.env.XERO_CLIENT_SECRET ?? "").update(`footprintos-xero:${label}`).digest();
export const xeroKey = () => derive("db").toString("hex");

export function sealTokens(tokens: { access_token: string; refresh_token: string }) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derive("tokens"), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

function openTokens(blob: string): { access_token: string; refresh_token: string } {
  const [iv, tag, body] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", derive("tokens"), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"));
}

const basicAuth = () => `Basic ${Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64")}`;

// Swap a sign-in code (after "Connect to Xero") or a refresh token for new tokens.
export async function xeroTokens(params: Record<string, string>) {
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token || !data.refresh_token) throw new Error(`Xero sign-in failed (${data.error ?? res.status})`);
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: new Date(Date.now() + (data.expires_in ?? 1800) * 1000) };
}

// A database connection with no one signed in (the key does the proving).
export const anonDb = () => createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });

export type XeroConnection = {
  tenantId: string;
  useOsNumbers: boolean;
  taxMap: Record<string, string>;
  call: (path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; data: Record<string, unknown> }>;
};

// The connection, with a fresh access token (refreshed and saved when it's
// about to run out). Null when Xero isn't connected or set up.
export async function getXero(db: SupabaseClient = anonDb()): Promise<XeroConnection | null> {
  if (!isXeroConfigured()) return null;
  const key = xeroKey();
  const { data } = await db.rpc("xero_connection", { p_key: key });
  const conn = data as { tenant_id: string | null; token_blob: string | null; token_expires_at: string | null; use_os_numbers: boolean; tax_map: Record<string, string> } | null;
  if (!conn?.tenant_id || !conn.token_blob) return null;

  let tokens = openTokens(conn.token_blob);
  let expires = conn.token_expires_at ? Date.parse(conn.token_expires_at) : 0;
  const refresh = async () => {
    const fresh = await xeroTokens({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
    tokens = fresh;
    expires = fresh.expires_at.getTime();
    const { error } = await db.rpc("xero_save_token", { p_key: key, p_token_blob: sealTokens(fresh), p_expires_at: fresh.expires_at.toISOString() });
    if (error) throw new Error(`Couldn't save the Xero sign-in: ${error.message}`);
  };
  if (expires - Date.now() < 2 * 60 * 1000) await refresh();

  const call: XeroConnection["call"] = async (path, init = {}) => {
    const go = () =>
      fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "xero-tenant-id": conn.tenant_id!,
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
      });
    let res = await go();
    if (res.status === 401) {
      await refresh();
      res = await go();
    }
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data: body };
  };
  return { tenantId: conn.tenant_id, useOsNumbers: conn.use_os_numbers, taxMap: conn.tax_map ?? {}, call };
}

// Xero's explanation of what went wrong, in one line.
export function xeroError(status: number, data: Record<string, unknown>): string {
  const elements = (data.Elements as { ValidationErrors?: { Message?: string }[] }[] | undefined) ?? [];
  const messages = elements.flatMap((e) => (e.ValidationErrors ?? []).map((v) => v.Message)).filter(Boolean);
  if (messages.length) return messages.join("; ");
  if (status === 429) return "Xero is busy (too many requests); it will be tried again shortly";
  return String(data.Detail ?? data.Message ?? data.Title ?? `Xero error ${status}`);
}

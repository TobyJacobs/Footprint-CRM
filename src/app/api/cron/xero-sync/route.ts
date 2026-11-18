import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isXeroConfigured, xeroKey } from "@/lib/xero/client";
import { runXeroSync } from "@/lib/xero/sync";

// Called every few minutes by netlify/functions/xero-sync.mts: sends queued
// invoices and credit notes to Xero. It must present the Xero key (made from
// the app secret in Netlify), so nobody else can trigger it.
export async function POST(request: NextRequest) {
  if (!isXeroConfigured()) return NextResponse.json({ ok: false, error: "Xero isn't set up" }, { status: 503 });
  const given = Buffer.from(request.headers.get("x-sync-key") ?? "");
  const expected = Buffer.from(xeroKey());
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 401 });
  const result = await runXeroSync();
  return NextResponse.json(result, { status: result.error === "Xero isn't connected" ? 200 : result.ok ? 200 : 207 });
}

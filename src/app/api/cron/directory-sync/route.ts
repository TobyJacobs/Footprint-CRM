import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isDirectoryConfigured } from "@/lib/entra/graph";
import { runDirectorySync } from "@/lib/entra/sync";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

// Called once a day by the Netlify scheduled function in
// netlify/functions/directory-sync.mts. It must present the secret sync key
// (DIRECTORY_SYNC_KEY); the database checks it against the stored fingerprint.
export async function POST(request: NextRequest) {
  const key = request.headers.get("x-sync-key") ?? "";
  if (key.length < 32) return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 401 });
  if (!isDirectoryConfigured()) {
    return NextResponse.json({ ok: false, error: "Microsoft 365 sync isn't set up" }, { status: 503 });
  }
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await runDirectorySync(supabase, key);
  return NextResponse.json(result, { status: result.ok ? 200 : result.error === "Not allowed" ? 401 : 500 });
}

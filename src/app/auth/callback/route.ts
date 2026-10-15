import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Microsoft sends people back here after they sign in. We swap the one-time
// code for a login session, then carry on to the page they wanted.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Browsers treat "/\site" like "//site" (another website), so refuse
  // backslashes and hidden control characters as well.
  const safeNext = /^\/(?![\/\\])/.test(next) && !/[\\\x00-\x1f]/.test(next) ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Record when an invited member of staff first signs in.
      await supabase.rpc("mark_staff_joined");
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=callback", origin));
}

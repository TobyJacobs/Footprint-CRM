import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";

// Pages anyone can reach without signing in. "/q/" (quote approval), "/d/"
// (view an invoice, credit note or order) and "/p/" (design proof approval)
// are the private links sent to customers — they only work with a secret token.
// "/portal" is the customer portal, which has its own sign-in (lib/portal).
// "/read/" is the public magazine flipbooks, "/f/" the website enquiry forms,
// and "/c/" (with /chat-widget.js) the website chat. "/api/email-events" is
// SendGrid's delivery reports (checked against SendGrid's signature), and
// "/api/control-room" is where outside bots connect (checked against each bot's key).
const OLD_HOST = "footprintgroupos.netlify.app";
const NEW_SITE = "https://os.footprintgroup.uk";

const PUBLIC_PATHS = ["/login", "/auth/", "/q/", "/d/", "/p/", "/api/cron/", "/invite/", "/portal", "/read/", "/f/", "/c/", "/book", "/chat-widget.js", "/api/email-events", "/api/control-room"];

// Runs before every page request: keeps the login session fresh and sends
// signed-out visitors to the login page. The real permission checks happen
// in the pages and in the database; this is only the first line of defence.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The old address forwards to the new one (owner, 18 November 2026), so
  // bookmarks and old links keep working and sign-in always finishes on
  // os.footprintgroup.uk. Only the plain old address: release-specific
  // addresses (<release>--footprintgroupos.netlify.app) and previews are left
  // alone, and so is /api/ (other services' calls work on either address).
  if (request.headers.get("host")?.toLowerCase() === OLD_HOST && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(`${NEW_SITE}${pathname}${request.nextUrl.search}`, 308);
  }
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!isSupabaseConfigured) {
    return isPublic
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Everything except static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

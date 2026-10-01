import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signInWithMicrosoft } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const errorMessages: Record<string, string> = {
  signin: "Sign-in didn't work. Please try again.",
  callback: "Microsoft sign-in couldn't be completed. Please try again.",
  inactive:
    "Your account has been switched off. If you think this is a mistake, speak to an admin.",
};

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default async function LoginPage(props: PageProps<"/login">) {
  const { error, next } = await props.searchParams;
  const errorKey = typeof error === "string" ? error : undefined;

  let signedIn = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims);
  }
  // Already signed in and nothing to explain: go straight in.
  if (signedIn && !errorKey) redirect("/");

  return (
    <div className="flex min-h-screen flex-col bg-fp-black">
      <div className="bg-fp-gradient h-1" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <Image
          src="/brand/footprint-logo-white.png"
          alt="Footprint Group"
          width={220}
          height={65}
          priority
          className="mb-8"
        />
        <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
          <h1 className="text-lg font-bold">Sign in to the Footprint Platform</h1>
          <p className="mt-1 text-sm text-fp-dark/75">
            Use your Footprint Microsoft 365 work account.
          </p>

          {errorKey && errorMessages[errorKey] && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-fp-error/30 bg-fp-error/5 px-3 py-2 text-sm text-fp-error"
            >
              {errorMessages[errorKey]}
            </p>
          )}

          {!isSupabaseConfigured ? (
            <p className="mt-6 rounded-md bg-fp-light px-3 py-2 text-sm text-fp-dark">
              The platform isn&apos;t connected to its database yet, so sign-in is switched off.
            </p>
          ) : signedIn ? (
            <form action="/auth/signout" method="post" className="mt-6">
              <button
                type="submit"
                className="w-full rounded-md border border-fp-border px-4 py-2.5 text-sm font-semibold hover:bg-fp-light"
              >
                Sign out
              </button>
            </form>
          ) : (
            <form action={signInWithMicrosoft} className="mt-6">
              <input type="hidden" name="next" value={typeof next === "string" ? next : "/"} />
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-md bg-fp-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-fp-dark"
              >
                <MicrosoftLogo />
                Sign in with Microsoft
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { signInWithMicrosoft } from "../../login/actions";

export const metadata: Metadata = { title: "You're invited", robots: { index: false, follow: false } };

// Where an invite email leads. The link itself grants nothing: the person
// still signs in with their Microsoft work account, and only gets in because
// an admin has activated them.
export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  let firstName: string | null = null;
  let valid = false;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_staff_invite", { p_token: token });
    if (data) {
      valid = true;
      firstName = (data as { first_name: string | null }).first_name || null;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-fp-black">
      <div className="bg-fp-gradient h-1" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <Image src="/brand/footprint-logo-white.png" alt="Footprint Group" width={220} height={65} priority className="mb-8" />
        <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
          {valid ? (
            <>
              <h1 className="text-lg font-bold">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
              <p className="mt-1 text-sm text-fp-dark/75">
                You&apos;ve been set up on FootprintOS. Sign in with your usual Microsoft work account to get
                started.
              </p>
              <form action={signInWithMicrosoft} className="mt-6">
                <input type="hidden" name="next" value="/" />
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-3 rounded-md bg-fp-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-fp-dark"
                >
                  <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  Sign in with Microsoft
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold">This invite link isn&apos;t valid</h1>
              <p className="mt-1 text-sm text-fp-dark/75">
                It may have been replaced or switched off. Ask an admin to send you a new invite.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

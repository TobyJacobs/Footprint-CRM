import type { Metadata } from "next";
import { primaryButton } from "@/components/ui";
import { signInWithLink } from "../../actions";

export const metadata: Metadata = { title: "Sign in" };

// Where the emailed link lands. Signing in takes a click, so email scanners
// that open links can't use up the one-time link.
export default async function PortalSignInPage(props: PageProps<"/portal/sign-in/[token]">) {
  const { token } = await props.params;
  return (
    <div className="mx-auto max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-black">Sign in to your customer portal</h1>
      <p className="mt-2 text-sm text-fp-dark/75">Click below to finish signing in.</p>
      <form action={signInWithLink.bind(null, token)} className="mt-6">
        <button type="submit" className={`${primaryButton} w-full`}>
          Sign in
        </button>
      </form>
    </div>
  );
}

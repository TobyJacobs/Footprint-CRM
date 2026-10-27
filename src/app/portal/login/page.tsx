import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { inputClass, primaryButton } from "@/components/ui";
import { getPortal } from "@/lib/portal";
import { requestPortalLink } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

const errorMessages: Record<string, string> = {
  email: "Please enter a valid email address.",
  link: "That sign-in link has expired or has already been used. Enter your email below and we'll send a new one.",
  setup: "The customer portal isn't switched on yet. Please contact us and we'll help.",
};

export default async function PortalLoginPage(props: PageProps<"/portal/login">) {
  const { error, sent, signedout } = await props.searchParams;
  if (!error && !sent && (await getPortal())) redirect("/portal");
  const message = typeof error === "string" ? errorMessages[error] : undefined;

  return (
    <div className="mx-auto max-w-md rounded-xl bg-white p-8 shadow-sm">
      <h1 className="text-xl font-black">Sign in to your customer portal</h1>
      <p className="mt-2 text-sm text-fp-dark/75">See your quotes and hosting plans with Footprint Group.</p>

      {message && (
        <p role="alert" className="mt-4 rounded-md border border-fp-error/30 bg-fp-error/5 px-3 py-2 text-sm text-fp-error">
          {message}
        </p>
      )}
      {signedout && !message && (
        <p role="status" className="mt-4 rounded-md bg-fp-light px-3 py-2 text-sm">
          You&apos;ve signed out.
        </p>
      )}

      {sent ? (
        <div role="status" className="mt-6 rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
          <p className="font-semibold">Check your inbox.</p>
          <p className="mt-1">
            If that email address is one we have for you, we&apos;ve sent a sign-in link. It works once, for 30 minutes. Nothing arrived? Check your junk
            folder, or contact us.
          </p>
        </div>
      ) : (
        <form action={requestPortalLink} className="mt-6 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Your email address</span>
            <input name="email" type="email" required autoComplete="email" className={inputClass} />
          </label>
          <button type="submit" className={primaryButton}>
            Email me a sign-in link
          </button>
          <p className="text-xs text-fp-mid">Use the email address we have for you as a contact.</p>
        </form>
      )}
    </div>
  );
}

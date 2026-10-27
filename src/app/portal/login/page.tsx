import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { inputClass, primaryButton } from "@/components/ui";
import { getPortal } from "@/lib/portal";
import { requestPortalLink, signInWithCode } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

const errorMessages: Record<string, string> = {
  email: "Please enter a valid email address.",
  link: "That sign-in link has expired or has already been used. Enter your email below and we'll send a new one.",
  setup: "The customer portal isn't switched on yet. Please contact us and we'll help.",
  code: "That code didn't work. Check it and try again. After 5 wrong tries, ask for a new email.",
  expired: "That took a little too long. Enter your email below and we'll send a new code.",
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
        <>
          <div role="status" className="mt-6 rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
            <p className="font-semibold">Check your inbox.</p>
            <p className="mt-1">
              If that email address is one we have for you, we&apos;ve sent a sign-in link and a 6-digit code. They work once, for 30 minutes. Nothing
              arrived? Check your junk folder, or contact us.
            </p>
          </div>
          <form action={signInWithCode} className="mt-6 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Reading the email on another device? Type the code here</span>
              <input
                name="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                placeholder="123456"
                className={`${inputClass} text-center text-2xl font-bold tracking-[0.4em]`}
              />
            </label>
            <button type="submit" className={primaryButton}>
              Sign in
            </button>
            <Link href="/portal/login" className="text-center text-xs font-semibold text-fp-teal-deep hover:underline">
              Use a different email, or send a new code
            </Link>
          </form>
        </>
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

import type { Metadata } from "next";
import Image from "next/image";
import { formStamp, loadPublicForm } from "@/lib/lead-forms";
import { submitEnquiry } from "./actions";
import FitFrame from "./FitFrame";

export const metadata: Metadata = { title: { absolute: "Get in touch · Footprint Group" }, robots: { index: false, follow: false } };

const input =
  "w-full rounded-md border border-fp-border bg-white px-3 py-2 text-sm focus:border-fp-pink focus:outline-none focus:ring-2 focus:ring-fp-pink/20";

// A website enquiry form. On its own it has a slim Footprint header; with
// ?embed=1 (inside a website's frame) it's just the form.
export default async function EnquiryForm(props: PageProps<"/f/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const embed = sp.embed === "1";
  const form = await loadPublicForm(id);
  const error = typeof sp.error === "string" ? sp.error.slice(0, 200) : null;

  const body = !form ? (
    <p className="text-sm text-fp-dark/75">This form isn&apos;t taking enquiries at the moment.</p>
  ) : sp.sent === "1" ? (
    <p role="status" className="rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
      {form.thank_you}
    </p>
  ) : (
    <form action={submitEnquiry.bind(null, form.public_id, embed)} className="grid gap-4 text-sm">
      {form.heading && <h1 className="text-xl font-bold">{form.heading}</h1>}
      {form.intro && <p className="whitespace-pre-line text-fp-dark/80">{form.intro}</p>}
      {error && (
        <p role="alert" className="rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-fp-error">
          {error}
        </p>
      )}
      <label className="grid gap-1">
        <span className="font-semibold">Your name</span>
        <input name="name" required maxLength={200} autoComplete="name" className={input} />
      </label>
      <label className="grid gap-1">
        <span className="font-semibold">Email</span>
        <input name="email" type="email" required maxLength={320} autoComplete="email" className={input} />
      </label>
      {(form.show_phone || form.show_company) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {form.show_phone && (
            <label className="grid gap-1">
              <span className="font-semibold">Phone (optional)</span>
              <input name="phone" type="tel" maxLength={50} autoComplete="tel" className={input} />
            </label>
          )}
          {form.show_company && (
            <label className="grid gap-1">
              <span className="font-semibold">Business (optional)</span>
              <input name="company" maxLength={200} autoComplete="organization" className={input} />
            </label>
          )}
        </div>
      )}
      {form.show_message && (
        <label className="grid gap-1">
          <span className="font-semibold">How can we help?</span>
          <textarea name="message" rows={5} maxLength={3000} className={input} />
        </label>
      )}
      {/* Spam trap: hidden from people, filled in by bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Leave this empty
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="t" value={formStamp(form.public_id)} />
      <input type="hidden" name="page" defaultValue="" />
      <p className="text-xs text-fp-dark/70">
        We&apos;ll only use your details to reply to your enquiry.
        {form.privacy_url && (
          <>
            {" "}
            See our{" "}
            <a href={form.privacy_url} target="_blank" rel="noopener noreferrer" className="underline">
              privacy policy
            </a>
            .
          </>
        )}
      </p>
      <div>
        <button type="submit" className="rounded-md bg-fp-pink px-5 py-2.5 text-sm font-semibold text-white hover:bg-fp-pink/90">
          {form.button_label}
        </button>
      </div>
    </form>
  );

  return (
    <main className={embed ? "relative bg-transparent p-1" : "relative min-h-screen bg-fp-offwhite"}>
      {/* Inside a website, let the website's own background show through. */}
      {embed && <style>{"html,body{background:transparent}"}</style>}
      {form && <FitFrame publicId={form.public_id} />}
      {!embed && (
        <header className="bg-fp-black">
          <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
            <Image src="/brand/footprint-logo-white.png" alt="Footprint Group" width={130} height={38} />
          </div>
        </header>
      )}
      <div className={embed ? "" : "mx-auto max-w-2xl px-4 py-8"}>
        <div className={embed ? "" : "rounded-lg border border-fp-border bg-white p-6"}>{body}</div>
      </div>
    </main>
  );
}

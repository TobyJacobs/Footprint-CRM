import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getPortal } from "@/lib/portal";
import { createSupportTicket } from "../../actions";

export const metadata: Metadata = { title: "Send us a message" };

// A customer asks for a change or asks a question. It goes to Footprint's
// Customer support tab and the team gets an email.
export default async function NewSupportMessagePage(props: PageProps<"/portal/support/new">) {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const { error, kind } = await props.searchParams;

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div>
        <Link href="/portal#support" className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to your portal
        </Link>
        <h1 className="mt-2 text-2xl font-black">Send us a message</h1>
        <p className="mt-1 text-sm text-fp-dark/75">Ask for a change or ask us anything. We&apos;ll reply here and email you when we do.</p>
      </div>

      {typeof error === "string" && (
        <p role="alert" className="rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-sm text-fp-error">
          {error}
        </p>
      )}

      <form action={createSupportTicket} className="grid gap-4 rounded-lg border border-fp-border bg-white p-6">
        {portal.customers.length > 1 ? (
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Which company is this about?</span>
            <select name="customer_id" required className={inputClass}>
              {portal.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="customer_id" value={portal.customers[0]?.id ?? ""} />
        )}
        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-1 font-semibold">What kind of message?</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="change" defaultChecked={kind !== "question"} /> A change I&apos;d like made
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="question" defaultChecked={kind === "question"} /> A question
          </label>
        </fieldset>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Subject</span>
          <input name="subject" required maxLength={200} placeholder="e.g. Update the opening hours on our website" className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Your message</span>
          <textarea name="body" required rows={7} maxLength={5000} className={inputClass} />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={primaryButton}>
            Send message
          </button>
          <Link href="/portal#support" className={secondaryButton}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

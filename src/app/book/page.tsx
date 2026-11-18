import type { Metadata } from "next";
import { connection } from "next/server";
import { formStamp } from "@/lib/lead-forms";
import { ukToday } from "@/lib/dates";
import { BOOKING_STAMP_ID, type BookingSetup } from "@/lib/online-booking";
import { createClient } from "@/lib/supabase/server";
import FitFrame from "../f/[id]/FitFrame";
import BookingForm from "./BookingForm";
import { submitBooking } from "./actions";

export const metadata: Metadata = { title: "Book your advert · Forget Me Not", robots: { index: false, follow: false } };

// Online advert booking (owner, 18 November 2026): shown on
// forgetmenotonline.org in a frame (?embed=1), or on its own.
export default async function BookPage(props: PageProps<"/book">) {
  await connection();
  const sp = await props.searchParams;
  const embed = sp.embed === "1";
  const key = process.env.PORTAL_LINK_KEY;
  const supabase = await createClient();
  const setup = key ? ((await supabase.rpc("online_booking_setup", { p_key: key })).data as BookingSetup | null) : null;
  const error = typeof sp.error === "string" ? sp.error.slice(0, 300) : null;

  const body =
    sp.sent === "1" ? (
      <div role="status" className="rounded-lg border border-fp-teal-deep/30 bg-fp-teal/10 p-5 text-sm text-fp-teal-deep">
        <p className="text-base font-bold">Thank you, we&apos;ve received your request.</p>
        <p className="mt-1">We&apos;ll check availability and confirm your space and final price by email within one working day. Nothing is payable until then.</p>
      </div>
    ) : !setup ? (
      <p className="text-sm text-fp-dark/75">Online booking isn&apos;t available right now. Please call us on 01329 288822 or email info@forgetmenotonline.org.</p>
    ) : (
      <>
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-sm text-fp-error">
            {error}
          </p>
        )}
        <BookingForm setup={setup} today={ukToday()} action={submitBooking.bind(null, embed)} stamp={formStamp(BOOKING_STAMP_ID)} />
      </>
    );

  return (
    <div className={embed ? "bg-transparent p-1" : "min-h-screen bg-fp-offwhite"}>
      <FitFrame publicId={BOOKING_STAMP_ID} />
      {embed ? (
        body
      ) : (
        <main className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="mb-1 text-2xl font-black">Book your advert</h1>
          <p className="mb-6 text-sm text-fp-dark/75">Forget Me Not, hand-delivered across Hampshire every month.</p>
          <div className="rounded-lg bg-white p-6 shadow-sm">{body}</div>
        </main>
      )}
    </div>
  );
}

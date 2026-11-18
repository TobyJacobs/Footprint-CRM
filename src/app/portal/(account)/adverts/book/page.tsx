import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import BookingForm from "@/app/book/BookingForm";
import { ukToday } from "@/lib/dates";
import { type BookingSetup } from "@/lib/online-booking";
import { getPortal } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { PortalPage } from "../../parts";
import { submitPortalBooking } from "./actions";

export const metadata: Metadata = { title: "Book more adverts" };

// Book more adverts from the portal (owner, 18 November 2026): the website's
// booking page, without typing your details.
export default async function PortalBookAdvertsPage(props: PageProps<"/portal/adverts/book">) {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const sp = await props.searchParams;
  const key = process.env.PORTAL_LINK_KEY;
  const setup = key ? ((await (await createClient()).rpc("online_booking_setup", { p_key: key })).data as BookingSetup | null) : null;

  return (
    <PortalPage title="Book more adverts" intro="Choose your editions, advert and months to see live prices and availability. We'll confirm within one working day.">
      <Link href="/portal/adverts" className="-mt-2 mb-2 inline-block text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Your adverts
      </Link>
      {typeof sp.error === "string" && (
        <p role="alert" className="mb-4 rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-sm text-fp-error">
          {sp.error.slice(0, 300)}
        </p>
      )}
      <div className="rounded-lg border border-fp-border bg-white p-6">
        {!setup ? (
          <p className="text-sm text-fp-dark/75">
            Booking isn&apos;t available right now.{" "}
            <Link href="/portal/support/new" className="font-semibold text-fp-teal-deep hover:underline">
              Send us a message
            </Link>{" "}
            and we&apos;ll sort it out.
          </p>
        ) : (
          <BookingForm setup={setup} today={ukToday()} action={submitPortalBooking} stamp="" known={{ customers: portal.customers }} />
        )}
      </div>
    </PortalPage>
  );
}

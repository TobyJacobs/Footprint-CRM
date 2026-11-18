import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPortal, getPortalSession } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { PortalPage } from "../../../parts";
import { submitReorder } from "./actions";
import ReorderForm, { type ReorderItem } from "./ReorderForm";

export const metadata: Metadata = { title: "Order again" };

// Order again (owner, 18 November 2026): a past order's items at today's
// prices, ready to adjust and send.
export default async function OrderAgainPage(props: PageProps<"/portal/orders/again/[token]">) {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const { token } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const sp = await props.searchParams;
  const session = await getPortalSession();
  const { data } = await (await createClient()).rpc("portal_reorder_items", { p_session: session, p_token: token });
  const order = data as { number: string; title: string | null; customer: string; items: ReorderItem[] } | null;
  if (!order) notFound();

  return (
    <PortalPage title="Order again" intro={`Based on your order ${order.number}${order.title ? ` (${order.title})` : ""} for ${order.customer}.`}>
      <Link href="/portal/orders" className="-mt-2 mb-2 inline-block text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Your orders
      </Link>
      {typeof sp.error === "string" && (
        <p role="alert" className="mb-4 rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-sm text-fp-error">
          {sp.error.slice(0, 300)}
        </p>
      )}
      <div className="rounded-lg border border-fp-border bg-white p-6">
        {order.items.length === 0 ? (
          <p className="text-sm text-fp-dark/75">
            There&apos;s nothing on this order to order again here.{" "}
            <Link href="/portal/support/new" className="font-semibold text-fp-teal-deep hover:underline">
              Send us a message
            </Link>{" "}
            instead.
          </p>
        ) : (
          <ReorderForm items={order.items} action={submitReorder.bind(null, token)} />
        )}
      </div>
    </PortalPage>
  );
}

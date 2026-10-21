import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Newspaper, Presentation } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { quoteKinds } from "@/lib/sales/options";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New opportunity" };

const icons = { quote: FileText, advertising: Newspaper, proposal: Presentation };

// Choose what kind of opportunity this is; each opens its own version of the
// quote page (with the customer filled in when started from a customer).
export default async function NewOpportunityPage(props: PageProps<"/sales/opportunity">) {
  await requirePermission("quotes", "edit");
  const sp = await props.searchParams;
  const customerId = typeof sp.customer === "string" && /^[0-9a-f-]{36}$/i.test(sp.customer) ? sp.customer : null;
  const { data: customer } = customerId
    ? await (await createClient()).from("customers").select("id, name").eq("id", customerId).maybeSingle()
    : { data: null };

  return (
    <div className="grid max-w-4xl gap-4">
      <Link href={customer ? `/customers/${customer.id}` : "/sales/quotes"} className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← {customer ? customer.name : "Quotes"}
      </Link>
      <h2 className="text-xl font-black">New opportunity{customer ? ` for ${customer.name}` : ""}</h2>
      <p className="text-sm text-fp-dark/75">What kind is it?</p>
      <ul className="grid gap-4 md:grid-cols-3">
        {quoteKinds.map((k) => {
          const Icon = icons[k.value];
          return (
            <li key={k.value}>
              <Link
                href={`/sales/new?type=quote&kind=${k.value}${customer ? `&customer=${customer.id}` : ""}`}
                className="grid h-full content-start gap-2 rounded-lg border border-fp-border bg-white p-5 transition-shadow hover:border-fp-pink/40 hover:shadow-md"
              >
                <Icon size={28} aria-hidden className="text-fp-pink" />
                <span className="text-lg font-black">{k.label}</span>
                <span className="text-sm text-fp-dark/75">{k.description}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

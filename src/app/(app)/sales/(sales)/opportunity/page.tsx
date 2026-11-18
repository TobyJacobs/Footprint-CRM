import { redirect } from "next/navigation";

// The old "what kind is it?" page: the kind is now chosen with the dropdown at
// the top of the new quote form, so old links go straight there.
export default async function NewOpportunityPage(props: PageProps<"/sales/opportunity">) {
  const sp = await props.searchParams;
  const customer = typeof sp.customer === "string" && /^[0-9a-f-]{36}$/i.test(sp.customer) ? `&customer=${sp.customer}` : "";
  redirect(`/sales/new?type=quote${customer}`);
}

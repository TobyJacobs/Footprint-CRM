import { redirect } from "next/navigation";
import { getPortal, portalAttention } from "@/lib/portal";
import PortalShell from "./PortalShell";

// Signed-in customers: the portal's side menu (laid out like FootprintOS),
// with a count by anything waiting for them.
export default async function PortalAccountLayout({ children }: { children: React.ReactNode }) {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const waiting = portalAttention(portal);
  return (
    <PortalShell
      name={portal.first_name ?? portal.email}
      email={portal.email}
      companies={portal.customers.map((c) => c.name)}
      badges={{ quotes: waiting.quotes.length, design: waiting.proofs.length, invoices: waiting.invoices.length, marketing: waiting.content.length }}
    >
      {children}
    </PortalShell>
  );
}

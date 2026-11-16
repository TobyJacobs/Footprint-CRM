import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Badge, secondaryButton } from "@/components/ui";
import { gbp, longDate } from "@/lib/customers/display";
import { ukToday } from "@/lib/dates";
import { getPortal } from "@/lib/portal";
import { PortalPage } from "../parts";

export const metadata: Metadata = { title: "Your invoices" };

export default async function PortalInvoicesPage() {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const several = portal.customers.length > 1;

  return (
    <PortalPage
      title="Your invoices"
      intro="Your invoices, what's still to pay, and a copy of each to view or download."
    >
      <Card>
        {portal.invoices.length === 0 ? (
          <p className="text-sm text-fp-mid">No invoices yet.</p>
        ) : (
          <>
            {portal.invoices.some((v) => Number(v.owed) > 0) && (
              <p className="mb-3 text-sm">
                Still to pay: <strong>{gbp(portal.invoices.reduce((sum, v) => sum + Number(v.owed), 0))}</strong>
              </p>
            )}
            <ul className="divide-y divide-fp-border text-sm">
              {portal.invoices.map((v) => {
                const owed = Number(v.owed);
                const overdue = owed > 0 && !!v.due_date && v.due_date < ukToday();
                return (
                  <li key={v.token} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {v.number}
                        {v.title ? ` · ${v.title}` : ""}
                      </p>
                      <p className="text-xs text-fp-mid">
                        {longDate(v.issue_date)}
                        {v.due_date && owed > 0 ? ` · due ${longDate(v.due_date)}` : ""}
                        {several ? ` · ${v.customer_name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{gbp(Number(v.total))}</span>
                      <Badge tone={owed === 0 ? "teal" : overdue ? "red" : "amber"}>
                        {owed === 0 ? "Paid" : overdue ? `Overdue · ${gbp(owed)}` : `To pay · ${gbp(owed)}`}
                      </Badge>
                      <Link href={`/d/${v.token}`} className={secondaryButton}>
                        View / PDF
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </PortalPage>
  );
}

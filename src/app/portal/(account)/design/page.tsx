import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, primaryButton } from "@/components/ui";
import { longDate } from "@/lib/customers/display";
import { jobNumber } from "@/lib/design/options";
import { advertArtworkLabel, getPortal, type PortalProof } from "@/lib/portal";
import { DesignTracker, Empty, PortalPage } from "../parts";

export const metadata: Metadata = { title: "Your design work" };

const proofLabel: Record<PortalProof["status"], { label: string; tone: "pink" | "teal" | "amber" }> = {
  waiting: { label: "Waiting for your approval", tone: "pink" },
  approved: { label: "You approved it", tone: "teal" },
  changes: { label: "You asked for changes", tone: "amber" },
};

// Every design job for the customer (including advert artwork), where each
// is up to, and every proof we've sent them. Finished jobs drop off after 60 days.
export default async function PortalDesignPage() {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login");
  const several = portal.customers.length > 1;
  const jobs = portal.artwork;

  return (
    <PortalPage title="Your design work" intro="Everything our designers are working on for you, the proofs we've sent and what you said about each one.">
      {jobs.length === 0 ? (
        <Empty>No design work at the moment.</Empty>
      ) : (
        jobs.map((j) => {
          const status = advertArtworkLabel(j.stage, j.artwork_source);
          const proofs = j.proofs ?? [];
          return (
            <Card key={j.number}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold leading-snug">{j.title}</h2>
                  <p className="text-xs text-fp-mid">
                    {jobNumber(j.number)}
                    {j.is_advert ? " · Advert artwork" : ""}
                    {j.order_number ? ` · order ${j.order_number}` : ""}
                    {several ? ` · ${j.customer_name}` : ""}
                  </p>
                </div>
                {j.proof_token ? (
                  <Link href={`/p/${j.proof_token}`} className={primaryButton}>
                    View and approve proof
                  </Link>
                ) : (
                  <Badge tone={status === "Artwork approved" ? "teal" : "grey"}>{j.stage === "done" ? "Finished" : status}</Badge>
                )}
              </div>
              <div className="mt-4">
                <DesignTracker stage={j.stage} />
              </div>
              {proofs.length > 0 && (
                <div className="mt-4 border-t border-fp-border pt-3">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-fp-mid">Proofs</h3>
                  <ul className="divide-y divide-fp-border text-sm">
                    {proofs.map((p) => (
                      <li key={p.token} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>
                          <strong>Proof {p.version ?? ""}</strong>
                          <span className="text-fp-mid">
                            {" "}
                            · sent {longDate(p.sent_at.slice(0, 10))}
                            {p.responded_at ? ` · answered ${longDate(p.responded_at.slice(0, 10))}` : ""}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <Badge tone={proofLabel[p.status].tone}>{proofLabel[p.status].label}</Badge>
                          <Link href={`/p/${p.token}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
                            View
                          </Link>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          );
        })
      )}
    </PortalPage>
  );
}

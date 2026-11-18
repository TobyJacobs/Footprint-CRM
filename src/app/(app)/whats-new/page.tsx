import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { Badge, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { longDate } from "@/lib/customers/display";
import { currentVersion, releases } from "@/lib/releases";

export const metadata: Metadata = { title: "What's new" };

// Every FootprintOS version and what changed in it (see lib/releases.ts).
// Open to everyone who's signed in.
export default async function WhatsNewPage() {
  await getCurrentUser();
  return (
    <>
      <PageHeader title="What's new" intro={`You're on FootprintOS ${currentVersion}. Each version and what changed in it, newest first.`} />
      <div className="grid max-w-3xl gap-6 px-6 py-8 lg:px-10">
        {releases.map((r) => (
          <Card
            key={r.version}
            title={`${r.version} · ${r.title}`}
            action={
              <span className="flex items-center gap-2 text-sm text-fp-mid">
                {r.version === currentVersion && <Badge tone="teal">Current</Badge>}
                {longDate(r.date)}
              </span>
            }
          >
            <ul className="grid list-disc gap-1.5 pl-5 text-sm">
              {r.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}

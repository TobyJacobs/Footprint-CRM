import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { gbp, longDate } from "@/lib/customers/display";
import { quoteKindLabel, statusLabel, statusToneFor, type DocType } from "@/lib/sales/options";

export type CustomerDoc = {
  id: string;
  doc_type: string;
  number: string;
  status: string;
  issue_date: string;
  total: number;
  title: string | null;
  quote_kind: string | null;
};

// One kind of document on a customer's page (quotes, sales orders, or invoices
// and credit notes): the latest few, a "New…" button and a link to see them all.
export default function CustomerDocsCard({
  title,
  docs,
  total,
  newHref,
  newLabel,
  seeAllHref,
}: {
  title: string;
  docs: CustomerDoc[];
  total: number;
  newHref: string | null;
  newLabel: string;
  seeAllHref: string;
}) {
  return (
    <Card
      title={`${title}${total ? ` (${total})` : ""}`}
      action={
        newHref ? (
          <Link href={newHref} className="inline-flex items-center gap-1 text-sm font-semibold text-fp-teal-deep hover:underline">
            <Plus size={14} aria-hidden /> {newLabel}
          </Link>
        ) : undefined
      }
    >
      {docs.length === 0 ? (
        <p className="text-sm text-fp-mid">None yet.</p>
      ) : (
        <ul className="divide-y divide-fp-border">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
              <span>
                <Link href={`/sales/${d.id}`} className="font-semibold hover:text-fp-pink">
                  {d.number}
                </Link>
                {d.doc_type === "credit_note" && <span className="text-fp-mid"> (credit note)</span>}
                {d.doc_type === "quote" && d.quote_kind && d.quote_kind !== "quote" && (
                  <span className="ml-2">
                    <Badge tone="pink">{quoteKindLabel(d.quote_kind)}</Badge>
                  </span>
                )}
                {d.title && <span className="text-fp-mid"> · {d.title}</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-fp-mid">{longDate(d.issue_date)}</span>
                <Badge tone={statusToneFor(d.status)}>{statusLabel(d.doc_type as DocType, d.status)}</Badge>
                <span className="w-24 text-right font-semibold">{gbp(Number(d.total))}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {total > docs.length && (
        <p className="mt-3 text-sm">
          <Link href={seeAllHref} className="font-semibold text-fp-teal-deep hover:underline">
            See all {total}
          </Link>
        </p>
      )}
    </Card>
  );
}

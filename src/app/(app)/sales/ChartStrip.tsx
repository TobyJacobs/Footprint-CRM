import Link from "next/link";
import { InvoicedChart, QuotesChart } from "@/components/charts/SalesCharts";
import { gbp } from "@/lib/customers/display";
import { getSalesStats } from "@/lib/sales/stats";

// A small chart above the Quotes and Invoices lists (last 6 months), with a
// link to the full Overview tab.
export default async function ChartStrip({ kind }: { kind: "quotes" | "invoices" }) {
  const stats = await getSalesStats({ months: 6 });
  const t = stats.totals;
  const money = (n: number) => gbp(n) ?? "£0.00";
  const facts =
    kind === "quotes"
      ? [
          ["Win rate", t.winRate === null ? "—" : `${t.winRate}%`],
          ["Open quotes", `${money(t.openQuotesValue)} (${t.openQuotes})`],
        ]
      : [
          ["Invoiced", money(t.invoiced)],
          ["Owed to us", money(t.owed)],
          ["Overdue", money(t.overdue)],
        ];

  return (
    <section className="mb-6 grid gap-4 rounded-lg border border-fp-border bg-white p-4 lg:grid-cols-[220px_1fr]">
      <div className="grid content-start gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-fp-mid">Last 6 months</p>
        {facts.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-fp-dark/70">{label}</p>
            <p className={`text-lg font-black ${label === "Overdue" && t.overdue > 0 ? "text-fp-error" : ""}`}>{value}</p>
          </div>
        ))}
        <Link href="/sales/overview" className="text-sm font-semibold text-fp-teal-deep hover:underline">
          Full overview →
        </Link>
      </div>
      <div className="min-w-0">
        {kind === "quotes" ? <QuotesChart months={stats.months} height={200} /> : <InvoicedChart months={stats.months} height={200} />}
      </div>
    </section>
  );
}

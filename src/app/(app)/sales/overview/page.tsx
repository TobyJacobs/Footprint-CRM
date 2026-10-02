import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ChartFilters from "@/components/charts/ChartFilters";
import { InvoicedChart, OwedChart, QuotesChart, TopCustomersChart } from "@/components/charts/SalesCharts";
import { Card } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { gbp } from "@/lib/customers/display";
import { getSalesStats } from "@/lib/sales/stats";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sales overview" };

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "pink" | "teal" | "red" }) {
  const colour = tone === "red" ? "text-fp-error" : tone === "teal" ? "text-fp-teal-deep" : tone === "pink" ? "text-fp-pink" : "";
  return (
    <div className="rounded-lg border border-fp-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-fp-mid">{label}</p>
      <p className={`mt-1 text-2xl font-black ${colour}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-fp-dark/70">{note}</p>}
    </div>
  );
}

export default async function SalesOverviewPage(props: PageProps<"/sales/overview">) {
  await requirePermission("quotes", "view");
  const sp = await props.searchParams;
  const months = [3, 6, 12, 24].includes(Number(sp.months)) ? Number(sp.months) : 12;
  const owner = typeof sp.owner === "string" && /^[0-9a-f-]{36}$/i.test(sp.owner) ? sp.owner : "";

  const supabase = await createClient();
  const [stats, { data: people }] = await Promise.all([
    getSalesStats({ months, ownerId: owner || null }),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
  ]);
  const t = stats.totals;
  const money = (n: number) => gbp(n) ?? "£0.00";
  const hasData = stats.months.some((m) => m.quoted || m.invoiced) || t.owed > 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fp-dark/75">Figures exclude VAT, except money owed. Drafts aren&apos;t counted.</p>
        <Suspense>
          <ChartFilters
            months={months}
            owner={owner}
            people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email }))}
          />
        </Suspense>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Tile label="Invoiced" value={money(t.invoiced)} note={`Last ${months} months, after credit notes`} />
        <Tile label="Margin" value={t.marginPct === null ? "—" : `${t.marginPct}%`} note="On invoices in the period" tone="teal" />
        <Tile
          label="Quotes won"
          value={t.winRate === null ? "—" : `${t.winRate}%`}
          note={`${t.quotesWon} won · ${t.quotesLost} lost`}
          tone="pink"
        />
        <Tile label="Open quotes" value={money(t.openQuotesValue)} note={`${t.openQuotes} waiting for an answer`} />
        <Tile
          label="Owed to us"
          value={money(t.owed)}
          note={t.overdue > 0 ? `${money(t.overdue)} overdue` : "Nothing overdue"}
          tone={t.overdue > 0 ? "red" : undefined}
        />
      </div>

      {!hasData && (
        <p className="rounded-md bg-fp-offwhite px-4 py-3 text-sm text-fp-dark/75">
          Nothing to show for this period yet. Charts fill in as quotes and invoices are sent.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Invoiced each month">
          <InvoicedChart months={stats.months} />
        </Card>
        <Card title="Quotes each month">
          <QuotesChart months={stats.months} />
        </Card>
        <Card title="Money owed by customers">
          <OwedChart owed={stats.owed} />
          <p className="mt-2 text-xs text-fp-dark/70">
            Unpaid invoices of any age, including VAT, after credit notes.{" "}
            <Link href="/sales/invoices" className="font-semibold text-fp-teal-deep hover:underline">
              See invoices
            </Link>
          </p>
        </Card>
        <Card title="Top customers">
          {stats.topCustomers.length === 0 ? (
            <p className="text-sm text-fp-dark/75">No invoices in this period yet.</p>
          ) : (
            <TopCustomersChart customers={stats.topCustomers} />
          )}
        </Card>
      </div>
    </div>
  );
}

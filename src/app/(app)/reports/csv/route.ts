import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addDaysTo, addMonthsTo, ukToday } from "@/lib/dates";
import { monthLabel } from "@/lib/magazines";
import {
  debtBands,
  getCustomers,
  getDebt,
  getMagazineReport,
  getSales,
  marginOf,
  periodFrom,
  salesGroups,
  toCsv,
  type SalesGroup,
} from "@/lib/reports";

// Download a report as CSV (opens in Excel). Same figures and rules as the
// page; needs the Reports permission.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user.can("reports", "view")) return new NextResponse("Not allowed", { status: 403 });
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const report = sp.report;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  let name = "report";
  let csv = "";

  if (report === "sales") {
    const period = periodFrom(sp);
    const group: SalesGroup = salesGroups.find((g) => g.key === sp.group)?.key ?? "month";
    const rows = await getSales(period.from, period.to, group);
    rows.sort((a, b) => (group === "month" ? a.key.localeCompare(b.key) : b.net - a.net));
    name = `sales-by-${group}-${period.from}-to-${period.to}`;
    csv = toCsv(
      [salesGroups.find((g) => g.key === group)!.label, "Sales (before VAT)", "Cost", "Gross profit", "Margin %", "Invoices"],
      rows.map((r) => [r.label, r2(r.net), r2(r.cost), r2(r.net - r.cost), marginOf(r.net, r.cost), group === "account" ? "" : r.docs]),
    );
  } else if (report === "debt") {
    const rows = (await getDebt()).sort((a, b) => b.daysOver - a.daysOver);
    name = `money-owed-${ukToday()}`;
    csv = toCsv(
      ["Invoice", "Customer", "Salesperson", "Issued", "Due", "Days overdue", "Age", "Invoice total", "Owed"],
      rows.map((r) => [
        r.number,
        r.customer_name,
        r.owner_name,
        r.issue_date,
        r.due_date,
        r.daysOver,
        debtBands.find((b) => b.key === r.band)?.label,
        r2(r.total),
        r2(r.owed),
      ]),
    );
  } else if (report === "customers") {
    const period = periodFrom(sp, "last_3");
    const { customers, lost } = await getCustomers(period.from, period.to);
    name = `customers-${period.from}-to-${period.to}`;
    csv = toCsv(
      ["Customer", "Sales (before VAT)", "Gross profit", "Margin %", "Invoices", "Period before", "Last invoice", "First ever invoice", "Buys", "Status"],
      [
        ...customers.map((c) => [
          c.name,
          r2(c.net),
          r2(c.net - c.cost),
          marginOf(c.net, c.cost),
          c.invoices,
          r2(c.before_net),
          c.last_date,
          c.first_date,
          (c.buys ?? []).join("; "),
          c.first_date && c.first_date >= period.from ? "New" : "Buying",
        ]),
        ...lost.map((c) => [c.name, 0, "", "", 0, r2(c.before_net), c.last_date, "", "", "Stopped buying"]),
      ],
    );
  } else if (report === "magazines" && user.can("magazines", "view")) {
    const ym = ukToday().slice(0, 7);
    const period = sp.period ? periodFrom(sp) : { from: `${ym}-01`, to: addDaysTo(`${addMonthsTo(ym, 6)}-01`, -1) };
    const r = await getMagazineReport(period.from, period.to);
    name = `magazine-mi-${period.from}-to-${period.to}`;
    csv = toCsv(
      ["Section", "Name", "Booked (before VAT)", "Target", "Adverts", "Pages sold", "Pages", "Advertisers", "New advertisers"],
      [
        ...r.editions.map((e) => ["Edition", `${e.code}. ${e.name}`, r2(e.net), r2(e.target), e.adverts, r2(e.pages_booked), e.pages, "", ""]),
        ...r.months.map((m) => ["Month", monthLabel(m.month), r2(m.net), r2(m.target), "", "", "", m.advertisers, m.new_advertisers]),
        ...r.sizes.map((s) => ["Size", s.size, r2(s.net), "", s.adverts, "", "", "", ""]),
        ...r.salespeople.map((s) => ["Salesperson", s.name, r2(s.net), "", s.adverts, "", "", "", ""]),
      ],
    );
  } else {
    return new NextResponse("Unknown report", { status: 400 });
  }

  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

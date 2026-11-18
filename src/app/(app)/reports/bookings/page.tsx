import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Tile, money } from "@/components/dashboards/parts";
import { Card, inputClass, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { monthLabel } from "@/lib/magazines";
import { bookingGroups, getBookings, magazinePeriod, periodQuery, summariseBookings, type BookingGroup } from "@/lib/reports";
import { CsvLink, PeriodPicker, num, td, th } from "../parts";

export const metadata: Metadata = { title: "Bookings" };

const pages = (n: number) => Math.round(n * 100) / 100;

// Forget Me Not bookings (Mag Manager's booking reports in one): every advert
// on a sales order that isn't cancelled, by issue month, grouped any way, with
// filters for an edition, a salesperson, a customer and premium positions.
export default async function BookingsReport(props: PageProps<"/reports/bookings">) {
  const user = await getCurrentUser();
  if (!user.can("magazines", "view")) redirect("/reports/sales");
  const sp = await props.searchParams;
  const period = magazinePeriod(sp);
  const group: BookingGroup = bookingGroups.find((g) => g.key === sp.group)?.key ?? "issue";
  const edition = typeof sp.edition === "string" ? sp.edition : "";
  const person = typeof sp.salesperson === "string" ? sp.salesperson : "";
  const customer = typeof sp.customer === "string" ? sp.customer : "";
  const premiumOnly = sp.premium === "1";
  const showList = sp.list === "1" || !!customer;

  const all = await getBookings(period.from, period.to);
  const editions = [...new Map(all.map((b) => [b.edition_code, b.edition_name])).entries()].sort();
  const people = [...new Set(all.map((b) => b.salesperson ?? "No salesperson"))].sort();
  const rows = all.filter(
    (b) =>
      (!edition || b.edition_code === edition) &&
      (!person || (b.salesperson ?? "No salesperson") === person) &&
      (!customer || b.customer_id === customer) &&
      (!premiumOnly || b.premium_position),
  );
  const summary = summariseBookings(rows, group);
  const net = rows.reduce((s, b) => s + b.net, 0);
  const pagesSold = rows.reduce((s, b) => s + b.pages, 0);
  const customerName = customer ? rows[0]?.customer_name ?? "this customer" : null;

  const filters: Record<string, string> = {
    group,
    ...(edition ? { edition } : {}),
    ...(person ? { salesperson: person } : {}),
    ...(customer ? { customer } : {}),
    ...(premiumOnly ? { premium: "1" } : {}),
    ...(showList ? { list: "1" } : {}),
  };
  const query = (extra: Record<string, string>) => new URLSearchParams({ ...filters, ...extra }).toString();
  const csv = `/reports/csv?report=bookings&${periodQuery(period)}&${new URLSearchParams(filters).toString()}`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker period={period} keep={filters} />
        <CsvLink href={csv} />
      </div>
      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <input type="hidden" name="period" value={period.preset} />
        {period.preset === "custom" && (
          <>
            <input type="hidden" name="from" value={period.from} />
            <input type="hidden" name="to" value={period.to} />
          </>
        )}
        {customer && <input type="hidden" name="customer" value={customer} />}
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-fp-mid">Group by</span>
          <select name="group" defaultValue={group} className={`${inputClass} w-auto`}>
            {bookingGroups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-fp-mid">Edition</span>
          <select name="edition" defaultValue={edition} className={`${inputClass} w-auto`}>
            <option value="">All editions</option>
            {editions.map(([code, name]) => (
              <option key={code} value={code}>
                {code}. {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-fp-mid">Salesperson</span>
          <select name="salesperson" defaultValue={person} className={`${inputClass} w-auto`}>
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 pb-2">
          <input type="checkbox" name="premium" value="1" defaultChecked={premiumOnly} className="accent-fp-pink" /> Premium positions only
        </label>
        <label className="flex items-center gap-1.5 pb-2">
          <input type="checkbox" name="list" value="1" defaultChecked={showList} className="accent-fp-pink" /> Show every advert
        </label>
        <button type="submit" className={secondaryButton}>
          Show
        </button>
      </form>
      {customerName && (
        <p className="text-sm">
          Showing <strong>{customerName}</strong> only.{" "}
          <Link href={`/reports/bookings?${periodQuery(period)}&${query({ customer: "", list: "" })}`} className="font-semibold text-fp-teal-deep hover:underline">
            Show all customers
          </Link>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Booked" value={money(net)} note={`${period.label} · before VAT`} />
        <Tile label="Adverts" value={String(rows.length)} note={`${new Set(rows.map((b) => b.customer_id)).size} advertisers`} />
        <Tile label="Pages sold" value={String(pages(pagesSold))} note={pagesSold ? `${money(net / pagesSold)} a page` : "—"} />
        <Tile label="Premium positions" value={String(rows.filter((b) => b.premium_position).length)} note="Covers, first page, centre spread…" tone="teal" />
      </div>

      <Card title={`By ${bookingGroups.find((g) => g.key === group)!.label.toLowerCase()}`}>
        {summary.length === 0 ? (
          <p className="text-sm text-fp-mid">No adverts booked for this choice.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-fp-border">
                <tr>
                  <th className={th}>{bookingGroups.find((g) => g.key === group)!.label}</th>
                  <th className={`${th} text-right`}>Adverts</th>
                  <th className={`${th} text-right`}>Advertisers</th>
                  <th className={`${th} text-right`}>Pages</th>
                  <th className={`${th} text-right`}>Booked</th>
                  <th className={`${th} text-right`}>Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {summary.map((s) => (
                  <tr key={s.key}>
                    <td className={`${td} font-semibold`}>
                      {s.customerId ? (
                        <Link href={`/reports/bookings?${periodQuery(period)}&${query({ customer: s.customerId, list: "1" })}`} className="hover:underline">
                          {s.label}
                        </Link>
                      ) : (
                        s.label
                      )}
                    </td>
                    <td className={num}>{s.adverts}</td>
                    <td className={num}>{s.customers}</td>
                    <td className={num}>{pages(s.pages)}</td>
                    <td className={num}>{money(s.net)}</td>
                    <td className={`${num} text-fp-dark/70`}>{net ? `${Math.round((s.net / net) * 100)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showList && (
        <Card title={`Every advert (${rows.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-fp-border">
                <tr>
                  <th className={th}>Issue</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Category</th>
                  <th className={th}>Size</th>
                  <th className={th}>Section</th>
                  <th className={th}>Premium</th>
                  <th className={th}>Salesperson</th>
                  <th className={th}>Order</th>
                  <th className={`${th} text-right`}>Booked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {rows.slice(0, 500).map((b) => (
                  <tr key={b.line_id}>
                    <td className={td}>
                      {b.edition_code} · {monthLabel(b.month)}
                    </td>
                    <td className={`${td} font-semibold`}>{b.customer_name ?? "—"}</td>
                    <td className={td}>{b.category ?? "—"}</td>
                    <td className={td}>{b.size ?? "—"}</td>
                    <td className={td}>{b.section ?? "—"}</td>
                    <td className={td}>{b.premium_position ?? "—"}</td>
                    <td className={td}>{b.salesperson ?? "—"}</td>
                    <td className={td}>
                      <Link href={`/sales/${b.order_id}`} className="text-fp-teal-deep hover:underline">
                        {b.order_number}
                      </Link>
                      {b.invoiced && <span className="ml-1 text-xs text-fp-mid">· invoiced</span>}
                    </td>
                    <td className={num}>{money(b.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 500 && <p className="mt-2 text-xs text-fp-mid">Showing the first 500. Download the CSV for all {rows.length}.</p>}
        </Card>
      )}
      <p className="text-xs text-fp-mid">
        Booked = adverts on sales orders that aren&apos;t cancelled, by the issue they appear in, before VAT. Categories are set on each customer and sections when
        adding adverts (lists in Magazines → Setup). Who hasn&apos;t booked again is on{" "}
        <Link href="/magazines/renewals" className="font-semibold text-fp-teal-deep hover:underline">
          Magazines → Renewals
        </Link>
        .
      </p>
    </div>
  );
}

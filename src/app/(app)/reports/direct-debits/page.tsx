import type { Metadata } from "next";
import Link from "next/link";
import { Tile, money } from "@/components/dashboards/parts";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { addDaysTo, addMonthsTo, ukToday } from "@/lib/dates";
import { getBookings, getDirectDebits } from "@/lib/reports";
import { CsvLink, num, td, th } from "../parts";

export const metadata: Metadata = { title: "Direct Debits" };

// Customers paying by Direct Debit (Mag Manager's Direct Debit list), from
// the Direct Debit fields on each customer, with what they have booked in
// Forget Me Not over the next three months.
export default async function DirectDebitReport() {
  const user = await getCurrentUser();
  const rows = await getDirectDebits();
  const ym = ukToday().slice(0, 7);
  const to = addDaysTo(`${addMonthsTo(ym, 3)}-01`, -1);
  const bookings = user.can("magazines", "view") ? await getBookings(`${ym}-01`, to) : [];
  const bookedFor = (id: string) => bookings.filter((b) => b.customer_id === id).reduce((s, b) => s + b.net, 0);
  const total = rows.reduce((s, r) => s + bookedFor(r.id), 0);

  return (
    <div className="grid gap-5">
      <div className="flex justify-end">
        <CsvLink href="/reports/csv?report=direct-debits" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Tile label="Paying by Direct Debit" value={String(rows.length)} note={`${rows.filter((r) => r.fmn === "Active").length} for Forget Me Not`} />
        {bookings.length > 0 && <Tile label="Their adverts booked" value={money(total)} note="This month and the next two · before VAT" tone="teal" />}
      </div>
      <Card title="Customers with an active Direct Debit">
        {rows.length === 0 ? (
          <p className="text-sm text-fp-mid">No customers are marked as paying by Direct Debit yet. Set it on the customer (Direct Debit fields).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-fp-border">
                <tr>
                  <th className={th}>Customer</th>
                  <th className={th}>Print &amp; Digital</th>
                  <th className={th}>Forget Me Not</th>
                  <th className={th}>Account owner</th>
                  {bookings.length > 0 && <th className={`${th} text-right`}>Booked next 3 months</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={td}>
                      <Link href={`/customers/${r.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className={td}>{r.general ?? "—"}</td>
                    <td className={td}>{r.fmn ?? "—"}</td>
                    <td className={td}>{r.owner ?? "—"}</td>
                    {bookings.length > 0 && <td className={num}>{bookedFor(r.id) ? money(bookedFor(r.id)) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-fp-mid">
        From each customer&apos;s Direct Debit fields (Active or FMN Active).
      </p>
    </div>
  );
}

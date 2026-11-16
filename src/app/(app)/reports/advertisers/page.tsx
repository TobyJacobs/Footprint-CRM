import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Tile, money } from "@/components/dashboards/parts";
import { Badge, Card, inputClass, secondaryButton } from "@/components/ui";
import { advertiserPeriod, getAdvertisers, mailingList } from "@/lib/advertisers";
import { getCurrentUser } from "@/lib/auth";
import { longDate } from "@/lib/customers/display";
import { monthLabel } from "@/lib/magazines";
import { periodQuery } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { CsvLink, PeriodPicker, td, th } from "../parts";

export const metadata: Metadata = { title: "Advertisers" };

// Magazine reports 5 (owner, 1 and 16 November 2026): advertisers in a
// period (by issue month), their contacts and latest activity, and a CSV
// mailing list of only the contacts who've agreed to emails (UK GDPR).

export default async function AdvertisersReport(props: PageProps<"/reports/advertisers">) {
  const user = await getCurrentUser();
  if (!user.can("magazines", "view")) redirect("/reports/sales");
  const sp = await props.searchParams;
  const period = advertiserPeriod(sp);
  const edition = typeof sp.edition === "string" && /^[0-9a-f-]{36}$/i.test(sp.edition) ? sp.edition : "";
  const supabase = await createClient();
  const [rows, { data: editions }] = await Promise.all([
    getAdvertisers(period.from, period.to, edition || null),
    supabase.from("magazine_editions").select("id, name").order("name"),
  ]);
  const mailing = mailingList(rows);
  const contacts = rows.reduce((s, r) => s + r.contacts.length, 0);
  const query = `${periodQuery(period)}${edition ? `&edition=${edition}` : ""}`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker period={period} keep={edition ? { edition } : {}} />
        <div className="flex flex-wrap gap-2">
          <CsvLink href={`/reports/csv?report=advertisers&${query}`} />
          <a href={`/reports/csv?report=mailing-list&${query}`} className={`${secondaryButton} inline-flex items-center gap-2`}>
            Download mailing list (CSV)
          </a>
        </div>
      </div>
      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="period" value={period.preset} />
        <input type="hidden" name="from" value={period.from} />
        <input type="hidden" name="to" value={period.to} />
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Edition</span>
          <select name="edition" defaultValue={edition} className={`${inputClass} w-auto`}>
            <option value="">All editions</option>
            {(editions ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={secondaryButton}>
          Show
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Advertisers" value={String(rows.length)} note={`Issues in ${period.label.toLowerCase()}`} />
        <Tile label="Contacts" value={String(contacts)} note={`${mailing.length} agreed to emails`} tone="teal" />
        <Tile label="Booked" value={money(rows.reduce((s, r) => s + r.net, 0))} note="Before VAT" />
      </div>

      <Card title="Advertisers">
        {rows.length === 0 ? (
          <p className="text-sm text-fp-mid">No adverts booked in these issues.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-fp-border">
                <tr>
                  <th className={th}>Advertiser</th>
                  <th className={th}>Editions</th>
                  <th className={`${th} text-right`}>Issues</th>
                  <th className={`${th} text-right`}>Booked</th>
                  <th className={th}>Latest issue</th>
                  <th className={th}>Contacts</th>
                  <th className={th}>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-fp-border align-top last:border-0">
                    <td className={`${td} font-semibold`}>
                      <Link href={`/customers/${r.id}`} className="hover:text-fp-pink">
                        {r.name}
                      </Link>
                      {(r.phone || r.email) && <span className="block text-xs font-normal text-fp-mid">{[r.phone, r.email].filter(Boolean).join(" · ")}</span>}
                    </td>
                    <td className={td}>{r.editions.join(", ")}</td>
                    <td className={`${td} text-right`}>{r.issues}</td>
                    <td className={`${td} text-right`}>{money(r.net)}</td>
                    <td className={td}>{monthLabel(r.lastMonth)}</td>
                    <td className={td}>
                      {r.contacts.length === 0 ? (
                        <span className="text-fp-mid">None</span>
                      ) : (
                        <ul className="grid gap-1">
                          {r.contacts.map((c, i) => (
                            <li key={i}>
                              {c.name}
                              {c.jobTitle ? <span className="text-fp-mid">, {c.jobTitle}</span> : null}
                              {c.consented && (
                                <span className="ml-1">
                                  <Badge tone="teal">Emails OK</Badge>
                                </span>
                              )}
                              <span className="block text-xs text-fp-mid">{[c.email, c.phone].filter(Boolean).join(" · ")}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className={td}>
                      {r.lastActivityOn ? longDate(r.lastActivityOn) : <span className="text-fp-mid">None</span>}
                      <Link href={`/customers/${r.id}#timeline`} className="block text-xs font-semibold text-fp-teal-deep hover:underline">
                        Notes and actions
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-fp-mid">
        The mailing list only has contacts ticked &ldquo;include in emails&rdquo; who haven&apos;t opted out (UK GDPR). To add someone, tick it on their
        contact once they&apos;ve agreed.
      </p>
    </div>
  );
}

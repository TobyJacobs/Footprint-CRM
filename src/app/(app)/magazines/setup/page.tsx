import type { Metadata } from "next";
import Link from "next/link";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Card, Notice, inputClass, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { addMonthsTo, ukMonth } from "@/lib/dates";
import { monthLabel, type AdvertSize, type Edition, type Issue } from "@/lib/magazines";
import { createClient } from "@/lib/supabase/server";
import { addIssueMonths, addMagazineListItem, saveAdvertSize, saveEdition, saveIssue, saveMagazineListItem, saveRates } from "../actions";
import MagazineTabs from "../MagazineTabs";

export const metadata: Metadata = { title: "Magazines setup" };

const small = `${inputClass} w-24 text-right`;

// Editions, the issues for one month, and advert sizes. Each row saves on its own.
export default async function MagazinesSetupPage(props: PageProps<"/magazines/setup">) {
  const user = await getCurrentUser();
  if (!user.can("magazines", "edit")) return <NoAccess title="Magazines setup" />;
  const sp = await props.searchParams;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : addMonthsTo(ukMonth(), 1);
  const supabase = await createClient();
  const [{ data: editions }, { data: issues }, { data: sizes }, { data: lastIssue }, { data: categories }, { data: sections }, { data: products }, { data: rates }] = await Promise.all([
    supabase.from("magazine_editions").select("*").order("code"),
    supabase.from("magazine_issues").select("*").eq("month", `${month}-01`),
    supabase.from("advert_sizes").select("*").order("position"),
    supabase.from("magazine_issues").select("month").order("month", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("magazine_categories").select("id, name, position, active").order("position").order("name"),
    supabase.from("magazine_sections").select("id, name, position, active").order("position").order("name"),
    supabase.from("magazine_rate_products").select("key, label").order("position"),
    supabase.from("magazine_rates").select("year, product, term, area, price"),
  ]);
  const rateYears = [...new Set((rates ?? []).map((r) => Number(r.year)))].sort((a, b) => b - a);
  const thisYear = Number(ukMonth().slice(0, 4));
  const rateYear = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : (rateYears.find((y) => y <= thisYear) ?? rateYears[0] ?? thisYear);
  const rateFor = (product: string, term: string, area: number) =>
    (rates ?? []).find((r) => Number(r.year) === rateYear && r.product === product && r.term === term && Number(r.area) === area)?.price ?? "";
  const eds = (editions ?? []) as Edition[];
  const issueByEdition = new Map(((issues ?? []) as Issue[]).map((i) => [i.edition_id, i]));
  const nextToAdd = lastIssue?.month ? addMonthsTo(String(lastIssue.month).slice(0, 7), 1) : month;

  return (
    <>
      <PageHeader title="Magazines setup" intro="Forget Me Not editions, each month's issues, the rate card and the advert sizes. Each row saves on its own." />
      <MagazineTabs current="setup" canEdit />
      <div className="grid gap-6 px-6 py-8 lg:px-10">
        <Notice searchParams={sp} />

        <Card title="Editions">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                <tr>
                  <th className="py-2 pr-2">Edition</th>
                  <th className="py-2 pr-2 text-right">Homes</th>
                  <th className="py-2 pr-2 text-right">Usual pages</th>
                  <th className="py-2 pr-2 text-right">Monthly target £</th>
                  <th className="py-2 pr-2">Active</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {eds.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-2">
                      <form id={`ed-${e.id}`} action={saveEdition.bind(null, e.id)} className="flex items-center gap-2">
                        <span className="w-5 font-bold">{e.code}.</span>
                        <input name="name" defaultValue={e.name} required aria-label="Edition name" className={inputClass} />
                      </form>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <input form={`ed-${e.id}`} name="distribution" type="number" min={0} defaultValue={e.distribution ?? ""} aria-label="Homes" className={small} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <input form={`ed-${e.id}`} name="default_pages" type="number" min={0} max={400} defaultValue={e.default_pages} aria-label="Usual pages" className={small} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <input form={`ed-${e.id}`} name="monthly_target" type="number" min={0} step="0.01" defaultValue={e.monthly_target ?? ""} aria-label="Monthly target" className={`${small} w-28`} />
                    </td>
                    <td className="py-2 pr-2">
                      <input form={`ed-${e.id}`} name="active" type="checkbox" defaultChecked={e.active} aria-label="Active" className="accent-fp-pink" />
                    </td>
                    <td className="py-2 text-right">
                      <button form={`ed-${e.id}`} type="submit" className={secondaryButton}>
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-fp-mid">Usual pages and the monthly target are used for new issues. Change an existing issue below.</p>
        </Card>

        <Card
          title={`Issues for ${monthLabel(month)}`}
          action={
            <div className="flex gap-2 text-sm">
              <Link href={`/magazines/setup?month=${addMonthsTo(month, -1)}`} className={secondaryButton}>
                ←
              </Link>
              <Link href={`/magazines/setup?month=${addMonthsTo(month, 1)}`} className={secondaryButton}>
                →
              </Link>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                <tr>
                  <th className="py-2 pr-2">Edition</th>
                  <th className="py-2 pr-2 text-right">Pages</th>
                  <th className="py-2 pr-2">Copy deadline</th>
                  <th className="py-2 pr-2 text-right">Target £</th>
                  <th className="py-2 pr-2">Complete</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {eds.map((e) => {
                  const i = issueByEdition.get(e.id);
                  if (!i) {
                    return (
                      <tr key={e.id}>
                        <td className="py-2 pr-2 font-semibold">
                          {e.code}. {e.name}
                        </td>
                        <td colSpan={5} className="py-2 text-fp-mid">
                          No issue for this month yet.
                        </td>
                      </tr>
                    );
                  }
                  const f = `is-${i.id}`;
                  return (
                    <tr key={e.id}>
                      <td className="py-2 pr-2 font-semibold">
                        <form id={f} action={saveIssue.bind(null, i.id, month)} />
                        {e.code}. {e.name}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <input form={f} name="pages" type="number" min={0} max={400} defaultValue={i.pages} aria-label="Pages" className={small} />
                      </td>
                      <td className="py-2 pr-2">
                        <input form={f} name="copy_deadline" type="date" defaultValue={i.copy_deadline ?? ""} aria-label="Copy deadline" className={`${inputClass} w-40`} />
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <input form={f} name="sales_target" type="number" min={0} step="0.01" defaultValue={i.sales_target ?? ""} aria-label="Target" className={`${small} w-28`} />
                      </td>
                      <td className="py-2 pr-2">
                        <input form={f} name="complete" type="checkbox" defaultChecked={i.complete} aria-label="Complete" className="accent-fp-pink" />
                      </td>
                      <td className="py-2 text-right">
                        <button form={f} type="submit" className={secondaryButton}>
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <form action={addIssueMonths} className="mt-4 flex flex-wrap items-end gap-2 text-sm">
            <label className="grid gap-1">
              <span className="font-semibold">Add 12 months of issues from</span>
              <input name="from" type="month" defaultValue={nextToAdd} required className={`${inputClass} w-44`} />
            </label>
            <button type="submit" className={secondaryButton}>
              Add issues
            </button>
            <span className="text-xs text-fp-mid">Months that already exist are left as they are.</span>
          </form>
        </Card>

        <Card
          title={`Rate card ${rateYear}`}
          action={
            <form method="get" className="flex items-center gap-2 text-sm">
              {typeof sp.month === "string" && <input type="hidden" name="month" value={sp.month} />}
              <select name="year" defaultValue={rateYear} aria-label="Year" className={`${inputClass} w-auto`}>
                {[...new Set([...rateYears, thisYear, thisYear + 1])].sort((a, b) => b - a).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button type="submit" className={secondaryButton}>
                Show
              </button>
            </form>
          }
        >
          <p className="mb-3 text-xs text-fp-mid">
            Price per advert per month, before VAT. Under 6 months and 6 months or more; 1st to 5th area (edition) booked, and every area after the 5th
            at the 5th&apos;s price. Leave a box empty for no price. Each row saves on its own.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                <tr>
                  <th className="py-2 pr-2">Product</th>
                  <th className="py-2 pr-2">Booking</th>
                  {[1, 2, 3, 4, 5].map((a) => (
                    <th key={a} className="py-2 pr-2 text-right">
                      {a === 5 ? "5th+ area" : `${["1st", "2nd", "3rd", "4th"][a - 1]} area`}
                    </th>
                  ))}
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {(products ?? []).map((p) => {
                  const f = `rate-${p.key}`;
                  return (["short", "long"] as const).map((term) => (
                    <tr key={`${p.key}-${term}`} className={term === "long" ? "" : "border-t-2 border-fp-border"}>
                      <td className="py-1.5 pr-2 font-semibold">
                        {term === "short" && (
                          <>
                            <form id={f} action={saveRates.bind(null, rateYear, p.key)} />
                            {p.label}
                          </>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-xs text-fp-dark/75">{term === "short" ? "Under 6 months" : "6 months +"}</td>
                      {[1, 2, 3, 4, 5].map((a) => (
                        <td key={a} className="py-1.5 pr-2 text-right">
                          <input
                            form={f}
                            name={`${term}_${a}`}
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={rateFor(p.key, term, a)}
                            aria-label={`${p.label}, ${term === "short" ? "under 6 months" : "6 months or more"}, area ${a}`}
                            className={`${inputClass} w-24 text-right`}
                          />
                        </td>
                      ))}
                      <td className="py-1.5 text-right">
                        {term === "short" && (
                          <button form={f} type="submit" className={secondaryButton}>
                            Save
                          </button>
                        )}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-fp-mid">
            Premium positions use their own rows: Front cover, Back cover, Inside front/back (one price), Centre spread (Centre page) and First page
            (Page 3). Facing editorial has no rate-card price.
          </p>
        </Card>

        <Card title="Advert sizes">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                <tr>
                  <th className="py-2 pr-2">Size</th>
                  <th className="py-2 pr-2 text-right">Width mm</th>
                  <th className="py-2 pr-2 text-right">Height mm</th>
                  <th className="py-2 pr-2 text-right">Part of a page</th>
                  <th className="py-2 pr-2">Priced as</th>
                  <th className="py-2 pr-2 text-right">Usual price £</th>
                  <th className="py-2 pr-2">Active</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-fp-border">
                {((sizes ?? []) as AdvertSize[]).map((s) => {
                  const f = `sz-${s.id}`;
                  return (
                    <tr key={s.id}>
                      <td className="py-2 pr-2 font-semibold">
                        <form id={f} action={saveAdvertSize.bind(null, s.id)} />
                        {s.name}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <input form={f} name="width_mm" type="number" min={0} step="0.01" defaultValue={s.width_mm ?? ""} aria-label="Width" className={small} />
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <input form={f} name="height_mm" type="number" min={0} step="0.01" defaultValue={s.height_mm ?? ""} aria-label="Height" className={small} />
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <input form={f} name="page_fraction" type="number" min={0.0001} max={4} step="0.0001" defaultValue={s.page_fraction} required aria-label="Part of a page" className={small} />
                      </td>
                      <td className="py-2 pr-2">
                        <select form={f} name="rate_product" defaultValue={(s as AdvertSize & { rate_product?: string | null }).rate_product ?? ""} aria-label="Priced as" className={`${inputClass} w-40`}>
                          <option value="">No rate-card price</option>
                          {(products ?? []).map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <input form={f} name="default_price" type="number" min={0} step="0.01" defaultValue={s.default_price ?? ""} placeholder="Rate card" aria-label="Usual price" className={small} />
                      </td>
                      <td className="py-2 pr-2">
                        <input form={f} name="active" type="checkbox" defaultChecked={s.active} aria-label="Active" className="accent-fp-pink" />
                      </td>
                      <td className="py-2 text-right">
                        <button form={f} type="submit" className={secondaryButton}>
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-fp-mid">
            Part of a page counts pages booked (0.25 = a quarter). Small Ad is set to 1/16 of a page; please check. &ldquo;Priced as&rdquo; picks the rate-card
            row; the usual price is only used for sizes with no rate-card price.
          </p>
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          {(
            [
              ["category", "Advertiser categories", "The kind of business, e.g. Trades or Food & Drink. Set on each customer; used by the Bookings report.", categories],
              ["section", "Magazine sections", "Where in the magazine an advert goes. Chosen when adding adverts to a quote.", sections],
            ] as const
          ).map(([kind, title, help, rows]) => (
            <Card key={kind} title={title}>
              <p className="mb-3 text-xs text-fp-mid">{help}</p>
              <ul className="grid gap-2 text-sm">
                {(rows ?? []).map((r) => (
                  <li key={r.id}>
                    <form action={saveMagazineListItem.bind(null, kind, r.id)} className="flex flex-wrap items-center gap-2">
                      <input name="position" type="number" defaultValue={r.position} aria-label="Order" className={`${inputClass} w-16`} />
                      <input name="name" required maxLength={80} defaultValue={r.name} aria-label="Name" className={`${inputClass} w-40 flex-1`} />
                      <label className="flex items-center gap-1 text-xs">
                        <input name="active" type="checkbox" defaultChecked={r.active} className="accent-fp-pink" /> In use
                      </label>
                      <button type="submit" className={secondaryButton}>
                        Save
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={addMagazineListItem.bind(null, kind)} className="mt-3 flex gap-2 text-sm">
                <input name="name" required maxLength={80} placeholder={kind === "category" ? "New category" : "New section"} aria-label={kind === "category" ? "New category" : "New section"} className={`${inputClass} w-56`} />
                <button type="submit" className={secondaryButton}>
                  Add
                </button>
              </form>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

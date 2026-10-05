import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { statusTone } from "@/lib/customers/display";
import { customerStatuses, services } from "@/lib/customers/options";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customers" };

const PAGE_SIZE = 50;

export default async function CustomersPage(props: PageProps<"/customers">) {
  const user = await requirePermission("customers", "view");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const service = typeof sp.service === "string" ? sp.service : "";
  const dupOnly = sp.dup === "1";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("customers_with_flags")
    .select("id, name, status, services, phone, email, billing_city, has_duplicate, contacts(first_name, last_name, is_primary)", {
      count: "exact",
    })
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) {
    // Match the customer name, phone, email or postcode, or any of its contacts.
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    const { data: contactHits } = await supabase
      .from("contacts")
      .select("customer_id")
      .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`)
      .not("customer_id", "is", null)
      .limit(200);
    const ids = [...new Set((contactHits ?? []).map((c) => c.customer_id as string))];
    const orParts = [
      `name.ilike.${like}`,
      `email.ilike.${like}`,
      `phone.ilike.${like}`,
      `billing_postcode.ilike.${like}`,
    ];
    if (ids.length) orParts.push(`id.in.(${ids.join(",")})`);
    query = query.or(orParts.join(","));
  }
  if (status) query = query.eq("status", status);
  if (service) query = query.contains("services", [service]);
  if (dupOnly) query = query.eq("has_duplicate", true);

  const { data: customers, count, error } = await query;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const link = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (service) params.set("service", service);
    if (dupOnly) params.set("dup", "1");
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/customers${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Customers" intro="Every customer and their contacts, hosting plans, retainers and history." />
      <div className="px-6 py-8 lg:px-10">
        <Notice searchParams={sp} />

        <div className="mb-6 flex flex-wrap items-end gap-3">
          <form className="flex flex-1 flex-wrap items-end gap-3" action="/customers">
            <label className="grid min-w-[220px] flex-1 gap-1 text-sm">
              <span className="font-semibold">Search</span>
              <input
                name="q"
                defaultValue={q}
                placeholder="Customer, contact, email, phone or postcode"
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Status</span>
              <select name="status" defaultValue={status} className={inputClass}>
                <option value="">Any</option>
                {customerStatuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Service</span>
              <select name="service" defaultValue={service} className={inputClass}>
                <option value="">Any</option>
                {services.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 py-2 text-sm">
              <input type="checkbox" name="dup" value="1" defaultChecked={dupOnly} className="accent-fp-pink" />
              Possible duplicates only
            </label>
            <button type="submit" className={secondaryButton}>
              Search
            </button>
            {(q || status || service || dupOnly) && (
              <Link href="/customers" className="py-2 text-sm font-semibold text-fp-teal-deep hover:underline">
                Clear
              </Link>
            )}
          </form>
          {user.can("customers", "edit") && (
            <Link href="/customers/new" className={`${primaryButton} inline-flex items-center gap-2`}>
              <Plus size={16} aria-hidden /> New customer
            </Link>
          )}
        </div>

        {error && <p className="mb-4 text-sm text-fp-error">Couldn&apos;t load customers: {error.message}</p>}

        <div className="overflow-x-auto rounded-lg border border-fp-border bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-fp-border bg-fp-offwhite text-xs uppercase tracking-wide text-fp-mid">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Primary contact</th>
                <th className="px-4 py-3 font-semibold">Services</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {(customers ?? []).map((c) => {
                const contacts = (c.contacts ?? []) as { first_name: string | null; last_name: string; is_primary: boolean }[];
                const primary = contacts.find((p) => p.is_primary) ?? contacts[0];
                return (
                  <tr key={c.id} className="border-b border-fp-border align-top last:border-0 hover:bg-fp-offwhite">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="font-semibold hover:text-fp-pink">
                        {c.name}
                      </Link>
                      {c.has_duplicate && (
                        <span className="ml-2 rounded-full bg-fp-amber/20 px-2 py-0.5 text-xs font-semibold">Possible duplicate</span>
                      )}
                      <div className="text-xs text-fp-mid">
                        {[c.billing_city, c.phone].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {primary ? [primary.first_name, primary.last_name].filter(Boolean).join(" ") : <span className="text-fp-mid">—</span>}
                      {contacts.length > 1 && <span className="text-xs text-fp-mid"> +{contacts.length - 1}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.services ?? []).map((s: string) => (
                          <Badge key={s}>{s}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">{c.status && <Badge tone={statusTone(c.status)}>{c.status}</Badge>}</td>
                  </tr>
                );
              })}
              {(customers ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-fp-mid">
                    {q || status || service || dupOnly ? "No customers match those filters." : "No customers yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-fp-dark/75">
          <span>
            {total.toLocaleString("en-GB")} customer{total === 1 ? "" : "s"}
          </span>
          {pages > 1 && (
            <span className="flex items-center gap-3">
              {page > 1 && (
                <Link href={link(page - 1)} className="font-semibold text-fp-teal-deep hover:underline">
                  ← Previous
                </Link>
              )}
              Page {page} of {pages}
              {page < pages && (
                <Link href={link(page + 1)} className="font-semibold text-fp-teal-deep hover:underline">
                  Next →
                </Link>
              )}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

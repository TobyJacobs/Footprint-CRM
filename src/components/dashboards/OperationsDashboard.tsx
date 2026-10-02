import { longDate } from "@/lib/customers/display";
import { getMonth, isoDate } from "@/lib/dashboards/data";
import { createClient } from "@/lib/supabase/server";
import { SimpleList, Tile, money } from "./parts";

// Operations team: orders to deliver, purchase orders and supplier deliveries.
export default async function OperationsDashboard() {
  const month = getMonth();
  const supabase = await createClient();
  const today = isoDate();
  const weekAhead = isoDate(7);
  const customerName = (c: unknown) => (c as { name: string } | null)?.name ?? "";
  const supplierName = (s: unknown) => (s as { name: string } | null)?.name ?? "";

  const [{ data: openOrders }, { data: draftPos, count: draftCount }, { data: latePos, count: lateCount }, { count: receivedCount }, { data: monthPos }] =
    await Promise.all([
      supabase
        .from("sales_documents")
        .select("id, number, title, deadline_date, production_step, total, customers!sales_documents_customer_id_fkey(name)")
        .eq("doc_type", "sales_order")
        .eq("status", "open")
        .order("deadline_date", { ascending: true, nullsFirst: false })
        .limit(500),
      supabase
        .from("purchase_orders")
        .select("id, number, total, created_at, suppliers(name)", { count: "exact" })
        .eq("status", "draft")
        .order("created_at", { ascending: true })
        .limit(8),
      supabase
        .from("purchase_orders")
        .select("id, number, expected_date, total, suppliers(name)", { count: "exact" })
        .eq("status", "sent")
        .lt("expected_date", today)
        .order("expected_date", { ascending: true })
        .limit(8),
      supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("status", "received"),
      supabase
        .from("purchase_orders")
        .select("total")
        .neq("status", "cancelled")
        .gte("issue_date", month.from)
        .lte("issue_date", month.to)
        .limit(5000),
    ]);

  const orders = openOrders ?? [];
  const overdueOrders = orders.filter((o) => o.deadline_date && o.deadline_date < today);
  const dueThisWeek = orders.filter((o) => o.deadline_date && o.deadline_date >= today && o.deadline_date <= weekAhead);
  const steps = new Map<string, number>();
  for (const o of orders) steps.set(o.production_step ?? "No step set", (steps.get(o.production_step ?? "No step set") ?? 0) + 1);
  const spend = (monthPos ?? []).reduce((s, p) => s + Number(p.total), 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Open sales orders" value={String(orders.length)} note={`${dueThisWeek.length} due in the next 7 days`} href="/sales/orders?status=open" />
        <Tile
          label="Orders past deadline"
          value={String(overdueOrders.length)}
          note={overdueOrders.length ? "Need chasing or a new date" : "All on time"}
          tone={overdueOrders.length ? "red" : "teal"}
        />
        <Tile
          label="Purchase orders to send"
          value={String(draftCount ?? 0)}
          note="Drafts not yet ordered"
          tone={draftCount ? "amber" : undefined}
          href="/sales/purchase-orders?status=draft"
        />
        <Tile
          label="Late supplier deliveries"
          value={String(lateCount ?? 0)}
          note={`${receivedCount ?? 0} received, waiting for the supplier's bill`}
          tone={lateCount ? "red" : undefined}
          href="/sales/purchase-orders?status=sent"
        />
        <Tile label="Supplier spend this month" value={money(spend)} note={`Purchase orders raised in ${month.label} (inc VAT)`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SimpleList
          title="Orders due soonest"
          empty="No open sales orders."
          action={{ href: "/sales/orders?status=open", label: "All orders" }}
          rows={[...overdueOrders, ...dueThisWeek, ...orders.filter((o) => !o.deadline_date || o.deadline_date > weekAhead)]
            .slice(0, 8)
            .map((o) => ({
              key: o.id,
              href: `/sales/${o.id}`,
              primary: `${o.number} · ${customerName(o.customers)}`,
              secondary: [o.production_step, o.title].filter(Boolean).join(" · "),
              right: o.deadline_date ? longDate(o.deadline_date) : "No deadline",
              tone: o.deadline_date && o.deadline_date < today ? "red" : o.deadline_date && o.deadline_date <= weekAhead ? "amber" : undefined,
            }))}
        />
        <section className="rounded-lg border border-fp-border bg-white p-5">
          <h2 className="mb-3 font-bold">Open orders by production step</h2>
          {steps.size === 0 ? (
            <p className="text-sm text-fp-dark/70">No open sales orders.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {[...steps.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([step, n]) => (
                  <li key={step} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div>
                      <p className="font-semibold">{step}</p>
                      <div className="mt-1 h-2 rounded-full bg-fp-light">
                        <div className="h-full rounded-full bg-fp-teal-deep" style={{ width: `${(n / orders.length) * 100}%` }} />
                      </div>
                    </div>
                    <span className="font-black">{n}</span>
                  </li>
                ))}
            </ul>
          )}
        </section>
        <SimpleList
          title="Purchase orders not sent yet"
          empty="Nothing waiting to be ordered."
          action={{ href: "/sales/purchase-orders", label: "All purchase orders" }}
          rows={(draftPos ?? []).map((p) => ({
            key: p.id,
            href: `/sales/purchase-orders/${p.id}`,
            primary: `${p.number} · ${supplierName(p.suppliers)}`,
            secondary: `Raised ${longDate(p.created_at)}`,
            right: money(Number(p.total)),
            tone: "amber",
          }))}
        />
        <SimpleList
          title="Late deliveries from suppliers"
          empty="No deliveries are late."
          rows={(latePos ?? []).map((p) => ({
            key: p.id,
            href: `/sales/purchase-orders/${p.id}`,
            primary: `${p.number} · ${supplierName(p.suppliers)}`,
            secondary: `Expected ${longDate(p.expected_date)}`,
            right: money(Number(p.total)),
            tone: "red",
          }))}
        />
      </div>
    </div>
  );
}

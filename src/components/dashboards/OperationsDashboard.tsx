import { longDate } from "@/lib/customers/display";
import { getMonth, isoDate } from "@/lib/dashboards/data";
import { currentStage, orderStages } from "@/lib/sales/stages";
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
        .select("id, number, title, status, subtotal, deadline_date, total, customers!sales_documents_customer_id_fkey(name)")
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

  // Each open order's stage, worked out the same way as the stage bar on the order.
  const ids = (openOrders ?? []).map((o) => o.id);
  const [{ data: projects }, { data: jobs }, { data: pos }, { data: invoices }] = ids.length
    ? await Promise.all([
        supabase.from("projects").select("number, sales_document_id").in("sales_document_id", ids),
        supabase.from("design_jobs").select("stage, sales_order_id").in("sales_order_id", ids),
        supabase.from("purchase_orders").select("sales_document_id").in("sales_document_id", ids),
        supabase.from("sales_documents").select("number, subtotal, source_document_id").eq("doc_type", "invoice").neq("status", "void").in("source_document_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const orders = (openOrders ?? []).map((o) => {
    const mine = (invoices ?? []).filter((i) => i.source_document_id === o.id);
    const stage = currentStage(
      orderStages({
        status: o.status,
        project: (projects ?? []).find((p) => p.sales_document_id === o.id) ?? null,
        designJobs: (jobs ?? []).filter((j) => j.sales_order_id === o.id),
        poCount: (pos ?? []).filter((p) => p.sales_document_id === o.id).length,
        invoices: mine,
        invoicedNet: mine.reduce((sum, i) => sum + Number(i.subtotal), 0),
        orderNet: Number(o.subtotal),
      }),
    );
    return { ...o, stage };
  });
  const overdueOrders = orders.filter((o) => o.deadline_date && o.deadline_date < today);
  const dueThisWeek = orders.filter((o) => o.deadline_date && o.deadline_date >= today && o.deadline_date <= weekAhead);
  const steps = new Map<string, number>();
  for (const o of orders) steps.set(o.stage, (steps.get(o.stage) ?? 0) + 1);
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
              secondary: [`Now: ${o.stage}`, o.title].filter(Boolean).join(" · "),
              right: o.deadline_date ? longDate(o.deadline_date) : "No deadline",
              tone: o.deadline_date && o.deadline_date < today ? "red" : o.deadline_date && o.deadline_date <= weekAhead ? "amber" : undefined,
            }))}
        />
        <section className="rounded-lg border border-fp-border bg-white p-5">
          <h2 className="mb-3 font-bold">Open orders by stage</h2>
          {steps.size === 0 ? (
            <p className="text-sm text-fp-dark/70">No open sales orders.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {[...steps.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([step, n]) => (
                  <li key={step} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div>
                      <p className="font-semibold">Now: {step}</p>
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

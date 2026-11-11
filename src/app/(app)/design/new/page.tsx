import type { Metadata } from "next";
import Link from "next/link";
import { Card, Notice, inputClass, primaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { saveJob } from "../actions";
import JobForm, { type JobValues } from "../JobForm";

export const metadata: Metadata = { title: "New design job" };

const UUID = /^[0-9a-f-]{36}$/i;
const param = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);

// A design job is started from a project or a sales order, neither needing the
// other (DJ, 11 November 2026; before, it had to be a project). Arriving with
// a project fills in the customer, sales order (if any) and title; arriving
// from a sales order uses its project if it has one, or else links straight to
// the order. Arriving with neither (e.g. from the Design board) asks which.
export default async function NewDesignJobPage(props: PageProps<"/design/new">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const orderId = param(sp.order);
  let projectId = param(sp.project);
  let order: { id: string; number: string; title: string | null; customers: unknown } | null = null;
  if (orderId && !projectId) {
    const [{ data: so }, { data: orderProject }] = await Promise.all([
      supabase.from("sales_documents").select("id, number, title, customers!sales_documents_customer_id_fkey(id, name)").eq("id", orderId).eq("doc_type", "sales_order").maybeSingle(),
      supabase.from("projects").select("id").eq("sales_document_id", orderId).maybeSingle(),
    ]);
    order = so;
    projectId = orderProject?.id ?? null;
  }

  const values: JobValues = {};
  let from: { label: string; href: string } | null = null;

  if (projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, number, name, sales_document_id, customers(id, name)")
      .eq("id", projectId)
      .maybeSingle();
    if (project) {
      values.project_id = project.id;
      values.sales_order_id = project.sales_document_id ?? null;
      values.customer = project.customers as unknown as { id: string; name: string } | null;
      values.title = project.name;
      from = order
        ? { label: `sales order ${order.number} and its project ${project.number}`, href: `/sales/${order.id}` }
        : { label: `project ${project.number}`, href: `/projects/${project.id}` };
    }
  }

  if (!from && order) {
    // No project on the order: the job links straight to the sales order.
    values.sales_order_id = order.id;
    values.customer = order.customers as { id: string; name: string } | null;
    values.title = order.title || `Design for ${order.number}`;
    from = { label: `sales order ${order.number}`, href: `/sales/${order.id}` };
  }

  if (!from) {
    // Neither yet: pick a project or a sales order (open ones, newest first).
    const [{ data: projects }, { data: orders }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, number, name, customers(name)")
        .in("status", ["active", "on_hold"])
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("sales_documents")
        .select("id, number, title, customers!sales_documents_customer_id_fkey(name)")
        .eq("doc_type", "sales_order")
        .in("status", ["open", "completed"])
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    return (
      <div className="grid max-w-3xl gap-4">
        <Link href="/design" className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Design board
        </Link>
        <h2 className="text-xl font-black">New design job</h2>
        <p className="text-sm text-fp-dark/75">Choose the project or the sales order this job is for. Either is fine: a job doesn&apos;t need both.</p>
        <Notice searchParams={sp} />
        <Card>
          {(projects ?? []).length > 0 ? (
            <form method="get" className="flex flex-wrap items-end gap-2">
              <label className="grid flex-1 gap-1 text-sm">
                <span className="font-semibold">Project</span>
                <select name="project" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Choose a project…
                  </option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number} · {p.name}
                      {(p.customers as unknown as { name: string } | null)?.name ? ` (${(p.customers as unknown as { name: string }).name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={primaryButton}>
                Next
              </button>
            </form>
          ) : (
            <p className="text-sm text-fp-mid">There are no open projects.</p>
          )}
          {(orders ?? []).length > 0 && (
            <form method="get" className="mt-4 flex flex-wrap items-end gap-2 border-t border-fp-border pt-4">
              <label className="grid flex-1 gap-1 text-sm">
                <span className="font-semibold">Or a sales order</span>
                <select name="order" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Choose a sales order…
                  </option>
                  {(orders ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.number}
                      {o.title ? ` · ${o.title}` : ""}
                      {(o.customers as unknown as { name: string } | null)?.name ? ` (${(o.customers as unknown as { name: string }).name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={primaryButton}>
                Next
              </button>
            </form>
          )}
          <p className="mt-3 text-xs text-fp-mid">
            Not there? Create the project first in{" "}
            <Link href="/projects" className="font-semibold text-fp-teal-deep hover:underline">
              Projects
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  const { pickable } = await loadPeople(supabase);
  const canEdit = user.can("design", "edit");

  return (
    <div className="grid max-w-3xl gap-4">
      <Link href={from.href} className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Back to {order ? `sales order ${order.number}` : from.label}
      </Link>
      <h2 className="text-xl font-black">{order ? "Request design" : "New design job"}</h2>
      <p className="text-sm text-fp-dark/75">This job will be linked to {from.label}.</p>
      {!canEdit && <p className="text-sm text-fp-dark/75">The design team will pick it up from the board. You’ll see its progress under Design → My jobs.</p>}
      <Notice searchParams={sp} />
      <Card>
        <JobForm action={saveJob.bind(null, null)} people={pickable} values={values} canSetStage={canEdit} submitLabel="Create design job" />
      </Card>
    </div>
  );
}

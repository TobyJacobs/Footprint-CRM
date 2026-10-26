import type { Metadata } from "next";
import Link from "next/link";
import { Card, Notice, inputClass, primaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { createProjectForOrder } from "../../projects/actions";
import { saveJob } from "../actions";
import JobForm, { type JobValues } from "../JobForm";

export const metadata: Metadata = { title: "New design job" };

const UUID = /^[0-9a-f-]{36}$/i;
const param = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);

// Design jobs are always started from a project (the owner's rule, 20 October
// 2026). Arriving with a project fills in the customer, sales order and title;
// arriving from a sales order ("Request design", 26 October 2026) uses the
// order's project, or offers to create it first (projects are made with
// "Create project" on the order); arriving with neither (e.g. from the
// Design board) asks which project first.
export default async function NewDesignJobPage(props: PageProps<"/design/new">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const orderId = param(sp.order);
  let projectId = param(sp.project);
  let order: { id: string; number: string } | null = null;
  if (orderId && !projectId) {
    const [{ data: so }, { data: orderProject }] = await Promise.all([
      supabase.from("sales_documents").select("id, number").eq("id", orderId).eq("doc_type", "sales_order").maybeSingle(),
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
    // Footprint's flow: the order's project comes first, then the design request.
    return (
      <div className="grid max-w-3xl gap-4">
        <Link href={`/sales/${order.id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Back to sales order {order.number}
        </Link>
        <h2 className="text-xl font-black">Request design</h2>
        <Notice searchParams={sp} />
        <Card>
          <p className="text-sm">Sales order {order.number} has no project yet. Design jobs belong to a project, so create the order&apos;s project first.</p>
          {user.can("projects", "edit") ? (
            <form action={createProjectForOrder.bind(null, order.id, "design")} className="mt-3">
              <button type="submit" className={primaryButton}>
                Create project and continue
              </button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-fp-mid">Ask someone who can create projects to press &ldquo;Create project&rdquo; on the order.</p>
          )}
        </Card>
      </div>
    );
  }

  if (!from) {
    // No project yet: pick one (open projects, newest first).
    const { data: projects } = await supabase
      .from("projects")
      .select("id, number, name, customers(name)")
      .in("status", ["active", "on_hold"])
      .order("created_at", { ascending: false })
      .limit(500);
    return (
      <div className="grid max-w-3xl gap-4">
        <Link href="/design" className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Design board
        </Link>
        <h2 className="text-xl font-black">New design job</h2>
        <p className="text-sm text-fp-dark/75">Design jobs are started from a project. Choose the project this job is for.</p>
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
            <p className="text-sm text-fp-mid">There are no open projects yet.</p>
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

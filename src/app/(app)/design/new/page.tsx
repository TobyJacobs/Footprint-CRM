import type { Metadata } from "next";
import Link from "next/link";
import { Card, Notice } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { saveJob } from "../actions";
import JobForm, { type JobValues } from "../JobForm";

export const metadata: Metadata = { title: "New design job" };

const UUID = /^[0-9a-f-]{36}$/i;
const param = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);

// Raising a job from a sales order, a project or a customer fills in the
// customer and the links; from the Design section it starts blank.
export default async function NewDesignJobPage(props: PageProps<"/design/new">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const orderId = param(sp.order);
  const projectId = param(sp.project);
  const customerId = param(sp.customer);

  const values: JobValues = {};
  let from: { label: string; href: string } | null = null;

  if (orderId) {
    const { data: order } = await supabase
      .from("sales_documents")
      .select("id, number, title, doc_type, deadline_date, customers(id, name)")
      .eq("id", orderId)
      .maybeSingle();
    if (order && order.doc_type === "sales_order") {
      const { data: project } = await supabase.from("projects").select("id").eq("sales_document_id", order.id).maybeSingle();
      values.sales_order_id = order.id;
      values.project_id = project?.id ?? null;
      values.customer = order.customers as unknown as { id: string; name: string } | null;
      values.title = order.title ?? "";
      values.due_date = order.deadline_date ?? null;
      from = { label: `sales order ${order.number}`, href: `/sales/${order.id}` };
    }
  } else if (projectId) {
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
      from = { label: `project ${project.number}`, href: `/projects/${project.id}` };
    }
  } else if (customerId) {
    const { data: customer } = await supabase.from("customers").select("id, name").eq("id", customerId).maybeSingle();
    if (customer) {
      values.customer = customer;
      from = { label: customer.name, href: `/customers/${customer.id}` };
    }
  }

  const { pickable } = await loadPeople(supabase);
  const canEdit = user.can("design", "edit");

  return (
    <div className="grid max-w-3xl gap-4">
      <Link href={from?.href ?? "/design"} className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← {from ? `Back to ${from.label}` : "Design board"}
      </Link>
      <h2 className="text-xl font-black">New design job</h2>
      {from && <p className="text-sm text-fp-dark/75">This job will be linked to {from.label}.</p>}
      {!canEdit && <p className="text-sm text-fp-dark/75">The design team will pick it up from the board. You’ll see its progress under Design → My jobs.</p>}
      <Notice searchParams={sp} />
      <Card>
        <JobForm action={saveJob.bind(null, null)} people={pickable} values={values} canSetStage={canEdit} submitLabel="Create design job" />
      </Card>
    </div>
  );
}

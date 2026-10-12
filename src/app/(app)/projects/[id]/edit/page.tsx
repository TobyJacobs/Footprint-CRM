import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveProject } from "../../actions";
import ProjectForm from "../../ProjectForm";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage(props: PageProps<"/projects/[id]/edit">) {
  await requirePermission("projects", "edit");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: project }, { data: people }] = await Promise.all([
    supabase.from("projects").select("*, customers(id, name), order:sales_document_id(number)").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
  ]);
  if (!project) notFound();
  const customer = project.customers as unknown as { id: string; name: string } | null;
  const order = project.order as unknown as { number: string } | null;

  return (
    <>
      <Link href={`/projects/${id}`} className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← {project.name}
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">Edit project</h2>
      <Notice searchParams={sp} />
      <ProjectForm
        action={saveProject.bind(null, id)}
        people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email }))}
        values={{
          name: project.name,
          customer,
          owner_id: project.owner_id,
          status: project.status,
          start_date: project.start_date,
          due_date: project.due_date,
          budget_hours: project.budget_hours === null ? null : Number(project.budget_hours),
          description: project.description,
          sales_order: order?.number ?? null,
        }}
        submitLabel="Save changes"
      />
    </>
  );
}

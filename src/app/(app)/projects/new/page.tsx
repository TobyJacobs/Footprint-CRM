import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveProject } from "../actions";
import ProjectForm from "../ProjectForm";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage(props: PageProps<"/projects/new">) {
  await requirePermission("projects", "edit");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: people }, { data: templates }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase.from("project_templates").select("id, name").eq("active", true).order("name"),
  ]);

  // Arriving from a customer's page pre-fills the customer.
  const customerId = typeof sp.customer === "string" ? sp.customer : null;
  const { data: customer } = customerId
    ? await supabase.from("customers").select("id, name").eq("id", customerId).maybeSingle()
    : { data: null };

  return (
    <>
      <Link href="/projects" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Projects
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">New project</h2>
      <Notice searchParams={sp} />
      <ProjectForm
        action={saveProject.bind(null, null)}
        people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email }))}
        templates={templates ?? []}
        values={{ customer: customer ? { id: customer.id, name: customer.name } : null }}
        submitLabel="Create project"
      />
    </>
  );
}

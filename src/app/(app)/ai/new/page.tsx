import type { Metadata } from "next";
import Link from "next/link";
import { Card, Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { DECISIONS_DATE } from "@/lib/ai/options";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { saveProject } from "../actions";
import ProjectForm from "../ProjectForm";

export const metadata: Metadata = { title: "New FootprintAI project" };

export default async function NewAiProjectPage(props: PageProps<"/ai/new">) {
  await requirePermission("ai", "edit");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { pickable } = await loadPeople(supabase);
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/ai" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← FootprintAI
      </Link>
      <h2 className="text-2xl font-black">Add a project</h2>
      <Notice searchParams={sp} />
      <Card>
        <ProjectForm action={saveProject.bind(null, null)} people={pickable} values={{ decision_date: DECISIONS_DATE }} submitLabel="Add project" />
      </Card>
    </div>
  );
}

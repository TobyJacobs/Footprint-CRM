import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import NoAccess from "@/components/NoAccess";
import { createClient } from "@/lib/supabase/server";
import ProjectsTabs from "./ProjectsTabs";

export const metadata: Metadata = { title: "Projects & Time" };

export default async function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  const user = await getCurrentUser();
  if (!user.can("projects", "view")) return <NoAccess title="Projects & Time" />;
  const supabase = await createClient();
  const { data: manager } = await supabase.rpc("is_projects_manager");
  return (
    <>
      <PageHeader title="Projects & Time" intro="Projects, tasks, who is working on what, and the hours spent." />
      <ProjectsTabs isManager={manager === true} />
      <div className="px-6 py-8 lg:px-10">{children}</div>
    </>
  );
}

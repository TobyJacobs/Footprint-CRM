import type { Metadata } from "next";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import ProjectsTabs from "./ProjectsTabs";

export const metadata: Metadata = { title: "Projects & Time" };

export default async function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  const user = await getCurrentUser();
  if (!user.can("projects", "view")) return <NoAccess title="Projects & Time" />;
  return (
    <>
      <PageHeader title="Projects & Time" intro="One project per job, its tasks, who is doing what, and the time spent." />
      <ProjectsTabs isAdmin={user.isAdmin} />
      <div className="px-6 py-8 lg:px-10">{children}</div>
    </>
  );
}

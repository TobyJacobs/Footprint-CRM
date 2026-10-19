import type { Metadata } from "next";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import DesignTabs from "./DesignTabs";

export const metadata: Metadata = { title: "Design Workload" };

export default async function DesignLayout({ children }: LayoutProps<"/design">) {
  const user = await getCurrentUser();
  if (!user.can("design", "view")) return <NoAccess title="Design Workload" />;
  return (
    <>
      <PageHeader title="Design Workload" intro="Every design job in one place: who's on it, what stage it's at, the proofs and the notes." />
      <DesignTabs />
      <div className="px-6 py-8 lg:px-10">{children}</div>
    </>
  );
}

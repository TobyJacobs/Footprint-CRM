import type { Metadata } from "next";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import MarketingTabs from "./MarketingTabs";

export const metadata: Metadata = { title: "Marketing" };

export default async function MarketingLayout({ children }: LayoutProps<"/marketing">) {
  const user = await getCurrentUser();
  if (!user.can("marketing", "view")) return <NoAccess title="Marketing" />;
  return (
    <>
      <PageHeader title="Marketing" intro="Client marketing work: your jobs, digital retainers, the content calendar and ad campaigns." />
      <MarketingTabs />
      <div className="px-6 py-8 lg:px-10">{children}</div>
    </>
  );
}

import type { Metadata } from "next";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { allowedTabs, dashboardTabLabels } from "@/lib/dashboards/analytics";
import DashboardsTabs from "./DashboardsTabs";

export const metadata: Metadata = { title: "Dashboards" };

export default async function DashboardsLayout({ children }: LayoutProps<"/dashboards">) {
  const user = await getCurrentUser();
  const tabs = allowedTabs(user);
  if (tabs.length === 0) return <NoAccess title="Dashboards" />;
  return (
    <>
      <PageHeader title="Dashboards" intro="Revenue, pipeline, renewals and time, over any period. You only see the figures your role allows." />
      <DashboardsTabs tabs={tabs.map((t) => ({ href: `/dashboards/${t}`, label: dashboardTabLabels[t] }))} />
      <div className="px-6 py-8 lg:px-10">{children}</div>
    </>
  );
}

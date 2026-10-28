import type { Metadata } from "next";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import ReportsTabs from "./ReportsTabs";

export const metadata: Metadata = { title: { default: "Reports", template: "%s · Reports · FootprintOS" } };

// Reports: needs the Reports permission (Directors and Finance to start).
export default async function ReportsLayout({ children }: LayoutProps<"/reports">) {
  const user = await getCurrentUser();
  if (!user.can("reports", "view")) return <NoAccess title="Reports" />;
  return (
    <>
      <PageHeader
        title="Reports"
        intro={`Figures from live FootprintOS data, with the same period last year and a CSV download for Excel.${user.seesAllSales ? "" : " Only your own customers are included."}`}
      />
      <ReportsTabs magazines={user.can("magazines", "view")} />
      <div className="px-4 py-6 sm:px-6 lg:px-10">{children}</div>
    </>
  );
}

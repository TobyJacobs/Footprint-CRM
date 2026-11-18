import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { requireAdmin } from "@/lib/auth";
import AdminTabs from "./AdminTabs";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Admin"
        intro="Manage who can use the platform and what they can see. Every change here is recorded in the audit log."
      />
      <AdminTabs />
      <div className="px-6 py-8 lg:px-10">{children}</div>
    </>
  );
}

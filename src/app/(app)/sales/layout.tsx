import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { requirePermission } from "@/lib/auth";
import SalesTabs from "./SalesTabs";

export const metadata: Metadata = { title: "Sales & Operations" };

export default async function SalesLayout({ children }: LayoutProps<"/sales">) {
  await requirePermission("quotes", "view");
  return (
    <>
      <div className="print:hidden">
        <PageHeader title="Sales & Operations" intro="Quotes, sales orders, invoices, purchasing and the product list." />
      </div>
      <SalesTabs />
      <div className="px-6 py-8 print:p-0 lg:px-10">{children}</div>
    </>
  );
}

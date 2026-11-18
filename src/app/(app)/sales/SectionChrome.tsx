import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { allowedTabs } from "@/lib/dashboards/analytics";
import SectionTabs, { type Section } from "./SectionTabs";

// Sales = finding and quoting work; Operations = everything after the order.
// Both share the /sales addresses (and the "quotes" permission).
const sections = {
  sales: {
    title: "Sales",
    intro: "The sales overview, quotes and the pipeline.",
    tabs: [
      { href: "/sales/overview", label: "Overview" },
      { href: "/sales/quotes", label: "Quotes" },
      { href: "/leads", label: "Leads" },
      { href: "/sales/pipeline", label: "Pipeline" },
    ],
  },
  operations: {
    title: "Operations",
    intro: "Sales orders, invoices, purchasing and the product list.",
    tabs: [
      { href: "/sales/orders", label: "Sales orders" },
      { href: "/sales/invoices", label: "Invoices" },
      { href: "/sales/credit-notes", label: "Credit notes" },
      { href: "/sales/recurring", label: "Recurring" },
      { href: "/sales/purchase-orders", label: "Purchase orders" },
      { href: "/sales/products", label: "Products" },
      { href: "/sales/suppliers", label: "Suppliers" },
    ],
  },
} as const;

export default async function SectionChrome({
  section,
  activeHref,
  children,
}: {
  section: Section;
  // The tab to highlight when the address doesn't say (e.g. a document page).
  activeHref?: string;
  children: React.ReactNode;
}) {
  const s = sections[section];
  // The Pipeline tab only for people who can see the pipeline dashboard.
  const canPipeline = allowedTabs(await getCurrentUser()).includes("pipeline");
  const tabs = s.tabs.filter((t) => t.href !== "/sales/pipeline" || canPipeline);
  return (
    <>
      <div className="print:hidden">
        <PageHeader title={s.title} intro={s.intro} />
      </div>
      <SectionTabs section={section} tabs={tabs} label={s.title} activeHref={activeHref} />
      <div className="px-6 py-8 print:p-0 lg:px-10">{children}</div>
    </>
  );
}

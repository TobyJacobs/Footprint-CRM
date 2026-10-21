import { requirePermission } from "@/lib/auth";

// Sales and Operations share these addresses; each page's heading and tabs
// come from SectionChrome (see the (sales) and (operations) folders).
export default async function SalesLayout({ children }: LayoutProps<"/sales">) {
  await requirePermission("quotes", "view");
  return children;
}

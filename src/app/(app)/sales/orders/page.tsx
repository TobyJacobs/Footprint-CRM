import type { Metadata } from "next";
import DocumentList from "../DocumentList";

export const metadata: Metadata = { title: "Sales orders" };

export default async function OrdersPage(props: PageProps<"/sales/orders">) {
  return <DocumentList docType="sales_order" searchParams={await props.searchParams} />;
}

import type { Metadata } from "next";
import DocumentList from "../DocumentList";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage(props: PageProps<"/sales/invoices">) {
  return <DocumentList docType="invoice" searchParams={await props.searchParams} />;
}

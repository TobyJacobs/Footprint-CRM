import type { Metadata } from "next";
import ChartStrip from "../ChartStrip";
import DocumentList from "../DocumentList";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage(props: PageProps<"/sales/invoices">) {
  return (
    <>
      <ChartStrip kind="invoices" />
      <DocumentList docType="invoice" searchParams={await props.searchParams} />
    </>
  );
}

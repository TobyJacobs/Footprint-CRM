import type { Metadata } from "next";
import ChartStrip from "../ChartStrip";
import DocumentList from "../DocumentList";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage(props: PageProps<"/sales/quotes">) {
  return (
    <>
      <ChartStrip kind="quotes" />
      <DocumentList docType="quote" searchParams={await props.searchParams} />
    </>
  );
}

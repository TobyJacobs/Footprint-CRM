import type { Metadata } from "next";
import DocumentList from "../DocumentList";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage(props: PageProps<"/sales/quotes">) {
  return <DocumentList docType="quote" searchParams={await props.searchParams} />;
}

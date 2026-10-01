import type { Metadata } from "next";
import DocumentList from "../DocumentList";

export const metadata: Metadata = { title: "Credit notes" };

export default async function CreditNotesPage(props: PageProps<"/sales/credit-notes">) {
  return <DocumentList docType="credit_note" searchParams={await props.searchParams} />;
}

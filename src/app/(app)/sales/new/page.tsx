import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getSalespersonOptions } from "@/lib/customers/staff";
import { customerDueDate, ukToday } from "@/lib/dates";
import { addDays, getCompanySettings, getCustomerWithContacts, getTaxRates } from "@/lib/sales/data";
import { docTypes, isDocType, isQuoteKind, proposalTemplate, quoteKinds } from "@/lib/sales/options";
import { saveDocument } from "../actions";
import DocumentForm from "../DocumentForm";
import SectionChrome from "../SectionChrome";

export const metadata: Metadata = { title: "New document" };

export default async function NewDocumentPage(props: PageProps<"/sales/new">) {
  const user = await requirePermission("quotes", "edit");
  const sp = await props.searchParams;
  const docType = isDocType(sp.type) ? sp.type : "quote";
  // A quote can be a standard quote, an advertising quote or a proposal.
  const kind = docType === "quote" && isQuoteKind(sp.kind) ? sp.kind : "quote";
  const customerId = typeof sp.customer === "string" && /^[0-9a-f-]{36}$/i.test(sp.customer) ? sp.customer : null;

  const [taxRates, staff, settings, picked] = await Promise.all([
    getTaxRates(),
    getSalespersonOptions(),
    getCompanySettings(),
    customerId ? getCustomerWithContacts(customerId) : Promise.resolve({ customer: null, contacts: [] }),
  ]);

  const today = ukToday();
  const terms =
    docType === "invoice" ? settings?.invoice_terms : docType === "sales_order" ? settings?.order_terms : settings?.quote_terms;

  return (
    <SectionChrome section={docType === "quote" ? "sales" : "operations"}>
      <Link
        href={docType === "quote" ? `/sales/opportunity${customerId ? `?customer=${customerId}` : ""}` : docTypes[docType].path}
        className="text-sm font-semibold text-fp-teal-deep hover:underline"
      >
        ← {docType === "quote" ? "Choose a different type" : docTypes[docType].plural}
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">
        {docType === "quote" ? quoteKinds.find((k) => k.value === kind)!.newLabel : `New ${docTypes[docType].label.toLowerCase()}`}
      </h2>
      <Notice searchParams={sp} />
      <DocumentForm
        docType={docType}
        quoteKind={kind}
        lines={[]}
        customer={picked.customer}
        contacts={picked.contacts}
        taxRates={taxRates}
        staff={staff}
        defaults={{
          issue_date: today,
          valid_until: addDays(settings?.quote_valid_days ?? 30),
          // The customer's own payment terms if they have any, else the company's.
          due_date:
            customerDueDate(today, picked.customer?.invoice_due_days, picked.customer?.invoice_due_terms) ?? addDays(settings?.invoice_due_days ?? 30),
          terms,
          notes: docType === "invoice" ? settings?.invoice_notes : kind === "proposal" ? proposalTemplate : null,
          title: kind === "proposal" ? "Proposal" : kind === "advertising" ? "Advertising in Forget Me Not" : null,
          business_unit: kind === "advertising" ? "Advertising" : null,
          owner_id: user.id,
        }}
        action={saveDocument.bind(null, docType, null)}
        cancelHref={docTypes[docType].path}
      />
    </SectionChrome>
  );
}

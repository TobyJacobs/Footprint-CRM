import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getSalespersonOptions } from "@/lib/customers/staff";
import { addDays, getCompanySettings, getCustomerWithContacts, getTaxRates } from "@/lib/sales/data";
import { docTypes, isDocType } from "@/lib/sales/options";
import { saveDocument } from "../actions";
import DocumentForm from "../DocumentForm";

export const metadata: Metadata = { title: "New document" };

export default async function NewDocumentPage(props: PageProps<"/sales/new">) {
  const user = await requirePermission("quotes", "edit");
  const sp = await props.searchParams;
  const docType = isDocType(sp.type) ? sp.type : "quote";
  const customerId = typeof sp.customer === "string" && /^[0-9a-f-]{36}$/i.test(sp.customer) ? sp.customer : null;

  const [taxRates, staff, settings, picked] = await Promise.all([
    getTaxRates(),
    getSalespersonOptions(),
    getCompanySettings(),
    customerId ? getCustomerWithContacts(customerId) : Promise.resolve({ customer: null, contacts: [] }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const terms =
    docType === "invoice" ? settings?.invoice_terms : docType === "sales_order" ? settings?.order_terms : settings?.quote_terms;

  return (
    <>
      <Link href={docTypes[docType].path} className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← {docTypes[docType].plural}
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">New {docTypes[docType].label.toLowerCase()}</h2>
      <Notice searchParams={sp} />
      <DocumentForm
        docType={docType}
        lines={[]}
        customer={picked.customer}
        contacts={picked.contacts}
        taxRates={taxRates}
        staff={staff}
        defaults={{
          issue_date: today,
          valid_until: addDays(settings?.quote_valid_days ?? 30),
          due_date: addDays(settings?.invoice_due_days ?? 30),
          terms,
          notes: docType === "invoice" ? settings?.invoice_notes : null,
          owner_id: user.id,
        }}
        action={saveDocument.bind(null, docType, null)}
        cancelHref={docTypes[docType].path}
      />
    </>
  );
}

import { createClient } from "@/lib/supabase/server";
import { docTypes, isDocType } from "@/lib/sales/options";
import SectionChrome from "../SectionChrome";

// A quote opens under Sales; orders, invoices and credit notes under Operations.
export default async function DocumentLayout({ children, params }: LayoutProps<"/sales/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = /^[0-9a-f-]{36}$/i.test(id)
    ? await supabase.from("sales_documents").select("doc_type").eq("id", id).maybeSingle()
    : { data: null };
  const type = isDocType(data?.doc_type) ? data.doc_type : null;
  return (
    <SectionChrome section={type === "quote" ? "sales" : "operations"} activeHref={type ? docTypes[type].path : undefined}>
      {children}
    </SectionChrome>
  );
}

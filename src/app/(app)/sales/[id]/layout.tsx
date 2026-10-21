import { createClient } from "@/lib/supabase/server";
import SectionChrome from "../SectionChrome";

// A quote opens under Sales; orders, invoices and credit notes under Operations.
export default async function DocumentLayout({ children, params }: LayoutProps<"/sales/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = /^[0-9a-f-]{36}$/i.test(id)
    ? await supabase.from("sales_documents").select("doc_type").eq("id", id).maybeSingle()
    : { data: null };
  return <SectionChrome section={data?.doc_type === "quote" ? "sales" : "operations"}>{children}</SectionChrome>;
}

import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { pdfFileName, renderDocumentPdf } from "@/lib/sales/pdf";
import { loadPrintableData } from "@/lib/sales/print-data";
import { createClient } from "@/lib/supabase/server";

// "Download PDF": the document as a PDF file (add ?view=1 to open it in the browser) (staff only; the database's rules
// decide which documents each person may see).
export async function GET(request: Request, ctx: RouteContext<"/sales/[id]/pdf">) {
  await requirePermission("quotes", "view");
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const found = await loadPrintableData(await createClient(), id);
  if (!found) notFound();
  const pdf = await renderDocumentPdf(found.data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // ?view=1 opens it in the browser instead of downloading it.
      "Content-Disposition": `${new URL(request.url).searchParams.get("view") === "1" ? "inline" : "attachment"}; filename="${pdfFileName(found.data)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

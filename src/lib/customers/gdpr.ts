import "server-only";
import { NextResponse } from "next/server";
import type { CurrentUser } from "@/lib/auth";

// Wraps exported data in a downloadable JSON file with a short explanation,
// suitable for answering a subject access request.
export function exportResponse(user: CurrentUser, filenameStem: string, subject: string, data: Record<string, unknown>) {
  const body = {
    about_this_file: {
      subject,
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      organisation: "Footprint Group",
      note:
        "Everything the Footprint Platform holds about this subject at the time of export, " +
        "including its change history. Prepared for a UK GDPR subject access request.",
    },
    ...data,
  };
  const safeName = filenameStem.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "export";
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gdpr-export-${safeName}-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

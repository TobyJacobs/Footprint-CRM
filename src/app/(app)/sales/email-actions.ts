"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { str } from "@/lib/forms";
import { deliverDocument } from "@/lib/sales/send-document";

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function addressList(value: string | null): string[] | null {
  if (!value) return [];
  const list = value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  return list.every((a) => EMAIL_RE.test(a)) ? list : null;
}

// The email box on a document: check the addresses, then send it with its
// PDF (see lib/sales/send-document).
export async function sendDocumentEmail(documentId: string, fd: FormData) {
  const user = await requirePermission("quotes", "edit");
  const back = `/sales/${documentId}`;

  const to = addressList(str(fd, "to"));
  const cc = addressList(str(fd, "cc"));
  const subject = str(fd, "subject");
  const message = str(fd, "message");
  if (!to || to.length === 0) fail(back, "Please enter a valid email address to send to");
  if (cc === null) fail(back, "One of the CC addresses doesn't look right");
  if (!subject || !message) fail(back, "Please add a subject and a message");

  const result = await deliverDocument(documentId, { to, cc, subject, message }, user);
  if (!result.ok) fail(back, result.error);
  revalidatePath("/sales", "layout");
  redirect(`${back}?emailed=${result.status}`);
}

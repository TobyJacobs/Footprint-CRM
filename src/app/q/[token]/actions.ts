"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { str } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// The customer's answer to a quote, from the private approval link. The
// database function checks the link, that it hasn't been answered already and
// that the quote hasn't expired.
export async function respondToQuote(token: string, accept: boolean, fd: FormData) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) redirect("/q/invalid");
  const h = await headers();
  const ip = h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const supabase = await createClient();
  const { data: problem, error } = await supabase.rpc("respond_to_quote", {
    p_token: token,
    p_accept: accept,
    p_name: str(fd, "name") ?? "",
    p_po: str(fd, "po") ?? "",
    p_note: str(fd, "note") ?? "",
    p_ip: ip ?? "",
  });

  const message = error ? "Something went wrong — please try again or contact us." : (problem as string | null);
  if (message) redirect(`/q/${token}?error=${encodeURIComponent(message)}`);
  redirect(`/q/${token}?done=${accept ? "accepted" : "declined"}`);
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { str } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// The customer's answer to a design proof, from the private approval link.
// The database function checks the link, that it is still the latest proof,
// hasn't expired and hasn't been answered already.
export async function respondToProof(token: string, approve: boolean, fd: FormData) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) redirect("/p/invalid");
  const h = await headers();
  const ip = h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const supabase = await createClient();
  const { data: problem, error } = await supabase.rpc("respond_to_proof", {
    p_token: token,
    p_approve: approve,
    p_name: str(fd, "name") ?? "",
    p_note: str(fd, "note") ?? "",
    p_ip: ip ?? "",
  });

  const message = error ? "Something went wrong — please try again or contact us." : (problem as string | null);
  if (message) redirect(`/p/${token}?error=${encodeURIComponent(message)}`);
  redirect(`/p/${token}`);
}

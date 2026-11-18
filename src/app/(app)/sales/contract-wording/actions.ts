"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Save the contract wording (DJ, 16 November 2026): admins and Directors only
// (the database checks too). Clauses with an empty title are removed.
export async function saveContractWording(fd: FormData) {
  const user = await requirePermission("quotes", "view");
  const back = "/sales/contract-wording";
  const supabase = await createClient();
  const { data: director } = await supabase.rpc("is_director");
  if (!user.isAdmin && director !== true) redirect(`${back}?error=${encodeURIComponent("Only admins and Directors can change the contract wording")}`);

  const titles = fd.getAll("title").map((v) => String(v).trim());
  const bodies = fd.getAll("body").map((v) => String(v).replace(/\r\n/g, "\n").trim());
  const clauses = titles
    .map((title, i) => ({ title: title.slice(0, 200), body: (bodies[i] ?? "").slice(0, 10000) }))
    .filter((c) => c.title);
  if (!clauses.length) redirect(`${back}?error=${encodeURIComponent("Please keep at least one clause")}`);
  if (clauses.some((c) => !c.body)) redirect(`${back}?error=${encodeURIComponent("Every clause needs some wording")}`);

  const { data, error } = await supabase.from("contract_wording").update({ clauses }).eq("id", 1).select("id");
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  if (!data?.length) redirect(`${back}?error=${encodeURIComponent("Only admins and Directors can change the contract wording")}`);
  revalidatePath("/sales", "layout");
  redirect(`${back}?saved=1`);
}

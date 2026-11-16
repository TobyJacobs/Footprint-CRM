import type { Metadata } from "next";
import Link from "next/link";
import { Card, Field, Notice, inputClass, primaryButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveContractWording } from "./actions";

export const metadata: Metadata = { title: "Contract wording" };

// The terms and conditions in proposal contracts (DJ, 16 November 2026).
// Everyone in Sales can read them; admins and Directors can change them.
// Contracts already signed keep the wording they were signed with.
export default async function ContractWordingPage(props: PageProps<"/sales/contract-wording">) {
  const user = await requirePermission("quotes", "view");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: wording }, { data: director }] = await Promise.all([
    supabase.from("contract_wording").select("clauses, updated_at").eq("id", 1).maybeSingle(),
    supabase.rpc("is_director"),
  ]);
  const canEdit = user.isAdmin || director === true;
  const clauses = ((wording?.clauses ?? []) as { title: string; body: string }[]).concat(canEdit ? [{ title: "", body: "" }] : []);

  return (
    <div className="grid max-w-4xl gap-6">
      <Link href="/sales" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Sales
      </Link>
      <h2 className="text-xl font-black">Contract wording</h2>
      <Notice searchParams={sp} />
      <Card title="About this wording">
        <p className="text-sm text-fp-dark/75">
          These are the terms and conditions in every proposal contract. Write <code>{"{notice_days}"}</code> where the proposal&apos;s termination
          notice period should go. Contracts already signed keep the wording they were signed with.{" "}
          {canEdit ? "Clear a clause's title to remove it; fill in the blank one at the end to add one." : "Only admins and Directors can change it."} If you
          change the meaning of a clause, it&apos;s worth asking your solicitor to check it.
        </p>
      </Card>
      <form action={saveContractWording} className="grid gap-4">
        {clauses.map((c, i) => (
          <Card key={i} title={c.title ? `${i + 1}. ${c.title}` : "Add a clause"}>
            <div className="grid gap-3">
              <Field label="Title">
                <input name="title" defaultValue={c.title} maxLength={200} readOnly={!canEdit} className={inputClass} />
              </Field>
              <Field label="Wording" hint="Leave a blank line between paragraphs.">
                <textarea name="body" rows={6} defaultValue={c.body} maxLength={10000} readOnly={!canEdit} className={inputClass} />
              </Field>
            </div>
          </Card>
        ))}
        {canEdit && (
          <div>
            <button type="submit" className={primaryButton}>
              Save contract wording
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

import type { Metadata } from "next";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Card, Notice, inputClass, primaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { longDate } from "@/lib/customers/display";
import { loadPeople } from "@/lib/design/jobs";
import { createClient } from "@/lib/supabase/server";
import { addMember, removeMember } from "../actions";

export const metadata: Metadata = { title: "FootprintAI invite list" };

// Admins choose who can see FootprintAI. Admins always can.
export default async function AiMembersPage(props: PageProps<"/ai/members">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: members }, { pickable, nameOf }, { data: admins }] = await Promise.all([
    supabase.from("ai_members").select("user_id, added_by, added_at").order("added_at"),
    loadPeople(supabase),
    supabase.from("profiles").select("id").eq("is_admin", true).eq("is_active", true),
  ]);
  const onList = new Set((members ?? []).map((m) => m.user_id as string));
  const adminIds = new Set((admins ?? []).map((a) => a.id as string));
  const canAdd = pickable.filter((p) => !onList.has(p.id) && !adminIds.has(p.id));

  return (
    <div className="grid max-w-3xl gap-6">
      <Notice searchParams={sp} />
      <Card title="Who can see FootprintAI">
        <p className="mb-4 text-sm text-fp-dark/75">
          FootprintAI is invite only. Admins can always see it; everyone else only once they&apos;re added here. Roles don&apos;t give access. People not on the list
          don&apos;t see it in the menu, and the database won&apos;t show them any of it.
        </p>
        <ul className="mb-6 grid gap-2 text-sm">
          {[...adminIds].map((id) => (
            <li key={id} className="flex items-center justify-between gap-2 rounded-md border border-fp-border px-3 py-2">
              <span className="font-semibold">{nameOf.get(id) ?? "Admin"}</span>
              <span className="text-xs text-fp-mid">Admin (always has access)</span>
            </li>
          ))}
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-fp-border px-3 py-2">
              <div>
                <span className="font-semibold">{nameOf.get(m.user_id) ?? "Someone"}</span>
                <span className="ml-2 text-xs text-fp-mid">
                  added {longDate(m.added_at)}
                  {m.added_by ? ` by ${nameOf.get(m.added_by) ?? "an admin"}` : ""}
                </span>
              </div>
              <form action={removeMember.bind(null, m.user_id)}>
                <ConfirmSubmit message={`Remove ${nameOf.get(m.user_id) ?? "this person"} from FootprintAI?`} className="text-xs font-semibold text-fp-error hover:underline">
                  Remove
                </ConfirmSubmit>
              </form>
            </li>
          ))}
        </ul>
        {canAdd.length > 0 ? (
          <form action={addMember} className="flex flex-wrap items-end gap-2">
            <label className="grid flex-1 gap-1 text-sm">
              <span className="font-semibold">Add someone</span>
              <select name="user_id" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Choose a person…
                </option>
                {canAdd.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={primaryButton}>
              Add to list
            </button>
          </form>
        ) : (
          <p className="text-sm text-fp-mid">Everyone who has signed in is already on the list.</p>
        )}
        <p className="mt-3 text-xs text-fp-mid">Only staff who have signed in to FootprintOS at least once can be added.</p>
      </Card>
    </div>
  );
}

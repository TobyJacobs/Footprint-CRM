import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { deleteRole, saveRole } from "../../actions";
import { ACTIONS, actionLabels, permissionFeatures } from "../../permissions";
import { Card, Notice, dangerButton, inputClass, primaryButton } from "../../ui";

export default async function EditRolePage(props: PageProps<"/admin/roles/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const [{ data: role }, { data: perms }] = await Promise.all([
    supabase.from("roles").select("id, name, description").eq("id", id).maybeSingle(),
    supabase.from("role_permissions").select("feature, action").eq("role_id", id),
  ]);
  if (!role) notFound();
  const granted = new Set((perms ?? []).map((p) => `${p.feature}:${p.action}`));

  return (
    <>
      <Link href="/admin/roles" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← All roles
      </Link>
      <h2 className="mb-6 mt-3 text-xl font-black">{role.name}</h2>
      <Notice searchParams={searchParams} />

      <form action={saveRole.bind(null, role.id)} className="grid max-w-3xl gap-6">
        <Card title="Details">
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Name</span>
              <input name="name" required defaultValue={role.name} className={inputClass} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Description (optional)</span>
              <input name="description" defaultValue={role.description ?? ""} className={inputClass} />
            </label>
          </div>
        </Card>

        <Card title="Permissions">
          <p className="mb-4 text-sm text-fp-dark/75">
            Tick what people with this role can do in each section. They&apos;ll only see sections they can view.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Section</th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="py-2 pr-4 text-center font-semibold">{actionLabels[a]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionFeatures.map((f) => (
                  <tr key={f.key} className="border-b border-fp-border last:border-0">
                    <td className="py-3 pr-4 font-semibold">{f.label}</td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="py-3 pr-4 text-center">
                        <input
                          type="checkbox"
                          name="perm"
                          value={`${f.key}:${a}`}
                          defaultChecked={granted.has(`${f.key}:${a}`)}
                          aria-label={`${f.label}: ${actionLabels[a]}`}
                          className="accent-fp-pink"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div>
          <button type="submit" className={primaryButton}>Save changes</button>
        </div>
      </form>

      <form action={deleteRole.bind(null, role.id)} className="mt-10 max-w-3xl border-t border-fp-border pt-6">
        <p className="mb-3 text-sm text-fp-dark/75">
          Deleting a role takes its permissions away from everyone who has it.
        </p>
        <button type="submit" className={dangerButton}>Delete role</button>
      </form>
    </>
  );
}

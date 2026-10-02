import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { ruleRole, type JobRoleRule } from "@/lib/entra/rules";
import { createClient } from "@/lib/supabase/server";
import DirectoryRoleCard, { type DirectoryEntry } from "../DirectoryRoleCard";

// Someone listed from Microsoft 365 who hasn't signed in yet. Their role is
// ready and waiting; teams and extra roles can be added once they sign in.
export default async function DirectoryPersonPage(props: PageProps<"/admin/directory/[dirId]">) {
  await requireAdmin();
  const { dirId } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();

  const [{ data: entry }, { data: roles }, { data: rules }] = await Promise.all([
    supabase
      .from("staff_directory")
      .select("id, email, display_name, job_title, department, office_location, account_enabled, in_entra, role_id, last_synced_at, profile_id")
      .eq("id", dirId)
      .maybeSingle(),
    supabase.from("roles").select("id, name").order("name"),
    supabase.from("job_role_rules").select("match_text, role_id, priority"),
  ]);
  if (!entry) notFound();
  if (entry.profile_id) redirect(`/admin/users/${entry.profile_id}`);

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <Link href="/admin/users" className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← All users
        </Link>
        <h2 className="mt-3 text-xl font-black">{entry.display_name ?? entry.email}</h2>
        <p className="mt-1 text-sm text-fp-dark/75">
          Hasn&apos;t signed in yet. When they do, they&apos;ll get the role below straight away. Teams and admin rights can be
          added after their first sign-in.
        </p>
      </div>
      <Notice searchParams={sp} />
      <DirectoryRoleCard
        entry={entry as DirectoryEntry}
        roles={roles ?? []}
        ruleRoleId={ruleRole(entry.job_title, (rules ?? []) as JobRoleRule[])}
        back={`/admin/directory/${dirId}`}
      />
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { ruleRole, type JobRoleRule } from "@/lib/entra/rules";
import { Card, Notice } from "../ui";

type DirRow = {
  id: string;
  email: string;
  display_name: string | null;
  job_title: string | null;
  department: string | null;
  account_enabled: boolean;
  in_entra: boolean;
  profile_id: string | null;
  role_id: string | null;
};

export default async function UsersPage(props: PageProps<"/admin/users">) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const sort = searchParams.sort === "role" || searchParams.sort === "title" ? searchParams.sort : "name";
  const supabase = await createClient();

  const [{ data: users }, { data: userRoles }, { data: roles }, { data: members }, { data: teams }, { data: directory }, { data: rules }] =
    await Promise.all([
      supabase.from("profiles").select("id, email, full_name, is_admin, is_active").order("full_name"),
      supabase.from("user_roles").select("user_id, role_id"),
      supabase.from("roles").select("id, name"),
      supabase.from("team_members").select("user_id, team_id"),
      supabase.from("teams").select("id, name"),
      supabase
        .from("staff_directory")
        .select("id, email, display_name, job_title, department, account_enabled, in_entra, profile_id, role_id"),
      supabase.from("job_role_rules").select("match_text, role_id, priority"),
    ]);

  const roleName = new Map((roles ?? []).map((r) => [r.id, r.name]));
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const dirRows = (directory ?? []) as DirRow[];
  const dirByProfile = new Map(dirRows.filter((d) => d.profile_id).map((d) => [d.profile_id!, d]));
  const rolesFor = (id: string) =>
    (userRoles ?? []).filter((r) => r.user_id === id).map((r) => roleName.get(r.role_id)).filter(Boolean) as string[];
  const teamsFor = (id: string) =>
    (members ?? []).filter((m) => m.user_id === id).map((m) => teamName.get(m.team_id)).filter(Boolean);

  // One list: everyone who has signed in, plus everyone in Microsoft 365 who hasn't yet.
  type Row = {
    key: string;
    href: string;
    name: string;
    email: string;
    jobTitle: string | null;
    department: string | null;
    roles: string[];
    teams: string;
    status: "admin" | "active" | "off" | "waiting";
  };
  const rows: Row[] = [
    ...(users ?? []).map((u): Row => {
      const d = dirByProfile.get(u.id);
      return {
        key: u.id,
        href: `/admin/users/${u.id}`,
        name: u.full_name ?? d?.display_name ?? u.email,
        email: u.email,
        jobTitle: d?.job_title ?? null,
        department: d?.department ?? null,
        roles: rolesFor(u.id),
        teams: teamsFor(u.id).join(", "),
        status: !u.is_active ? "off" : u.is_admin ? "admin" : "active",
      };
    }),
    ...dirRows
      .filter((d) => !d.profile_id && d.account_enabled && d.in_entra)
      .map((d): Row => {
        const role = d.role_id ?? ruleRole(d.job_title, (rules ?? []) as JobRoleRule[]);
        return {
          key: d.id,
          href: `/admin/directory/${d.id}`,
          name: d.display_name ?? d.email,
          email: d.email,
          jobTitle: d.job_title,
          department: d.department,
          roles: role && roleName.get(role) ? [roleName.get(role)!] : [],
          teams: "",
          status: "waiting",
        };
      }),
  ];
  rows.sort((a, b) =>
    sort === "role"
      ? (a.roles[0] ?? "~").localeCompare(b.roles[0] ?? "~") || a.name.localeCompare(b.name)
      : sort === "title"
        ? (a.jobTitle ?? "~").localeCompare(b.jobTitle ?? "~") || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
  );
  const waiting = rows.filter((r) => r.status === "waiting").length;
  const noRole = rows.filter((r) => (r.status === "active" || r.status === "waiting") && r.roles.length === 0).length;

  const sortLink = (key: string, label: string) => (
    <Link
      href={key === "name" ? "/admin/users" : `/admin/users?sort=${key}`}
      className={sort === key ? "text-fp-black underline" : "hover:text-fp-black"}
    >
      {label}
    </Link>
  );

  return (
    <>
      <Notice searchParams={searchParams} />
      <Card>
        <p className="mb-2 text-sm text-fp-dark/75">
          Everyone in Microsoft 365 is listed here, including people who haven&apos;t signed in yet. Roles come from their
          job title (see{" "}
          <Link href="/admin/directory" className="font-semibold text-fp-teal-deep hover:underline">
            Microsoft 365
          </Link>
          ), and you can change them for anyone. Click someone to sort them out.
        </p>
        <p className="mb-4 text-sm">
          {rows.length} people · {waiting} not signed in yet
          {noRole > 0 && (
            <>
              {" "}· <span className="font-semibold text-fp-error">{noRole} with no role (no access)</span>
            </>
          )}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
              <tr>
                <th className="py-2 pr-4 font-semibold">{sortLink("name", "Name")}</th>
                <th className="py-2 pr-4 font-semibold">{sortLink("title", "Job title")}</th>
                <th className="py-2 pr-4 font-semibold">{sortLink("role", "Roles")}</th>
                <th className="py-2 pr-4 font-semibold">Teams</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.key} className="border-b border-fp-border last:border-0">
                  <td className="py-3 pr-4">
                    <Link href={u.href} className="font-semibold hover:text-fp-pink">
                      {u.name}
                    </Link>
                    <div className="text-xs text-fp-mid">{u.email}</div>
                  </td>
                  <td className="py-3 pr-4">
                    {u.jobTitle ?? <span className="text-fp-mid">—</span>}
                    {u.department && <div className="text-xs text-fp-mid">{u.department}</div>}
                  </td>
                  <td className="py-3 pr-4">{u.roles.join(", ") || <span className="text-fp-mid">None</span>}</td>
                  <td className="py-3 pr-4">{u.teams || <span className="text-fp-mid">None</span>}</td>
                  <td className="py-3">
                    {u.status === "off" ? (
                      <Badge>Switched off</Badge>
                    ) : u.status === "admin" ? (
                      <Badge tone="pink">Admin</Badge>
                    ) : u.status === "waiting" ? (
                      <Badge tone="amber">Not signed in yet</Badge>
                    ) : (
                      <Badge tone="teal">Active</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

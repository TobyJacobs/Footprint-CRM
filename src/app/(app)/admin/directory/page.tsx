import Link from "next/link";
import { RefreshCw, Trash2 } from "lucide-react";
import { Badge, Card, Field, Notice, inputClass, primaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { shortDateTime } from "@/lib/customers/display";
import { isDirectoryConfigured, staffDomains } from "@/lib/entra/graph";
import { ruleRole, type JobRoleRule } from "@/lib/entra/rules";
import { createClient } from "@/lib/supabase/server";
import { addJobRoleRule, deleteJobRoleRule, syncDirectoryNow } from "../actions";
import SyncKeyCard from "./SyncKeyCard";

export default async function DirectoryPage(props: PageProps<"/admin/directory">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const supabase = await createClient();

  const [{ data: rules }, { data: roles }, { data: people }, { data: runs }, { data: settings }] = await Promise.all([
    supabase.from("job_role_rules").select("id, match_text, role_id, priority").order("priority").order("match_text"),
    supabase.from("roles").select("id, name").order("name"),
    supabase.from("staff_directory").select("job_title, role_id, account_enabled, in_entra"),
    supabase.from("directory_sync_runs").select("*").order("ran_at", { ascending: false }).limit(5),
    supabase.from("directory_sync_settings").select("key_set_at").maybeSingle(),
  ]);

  const roleName = new Map((roles ?? []).map((r) => [r.id, r.name]));
  const configured = isDirectoryConfigured();
  const current = (people ?? []).filter((p) => p.in_entra && p.account_enabled);

  // Every job title in Microsoft 365, how many people have it, and the role it gets.
  const titles = new Map<string, number>();
  for (const p of current) titles.set(p.job_title ?? "", (titles.get(p.job_title ?? "") ?? 0) + 1);
  const titleRows = [...titles.entries()]
    .map(([title, count]) => ({ title, count, role: ruleRole(title || null, (rules ?? []) as JobRoleRule[]) }))
    .sort((a, b) => Number(!!a.role) - Number(!!b.role) || a.title.localeCompare(b.title));
  const synced = typeof sp.synced === "string" ? sp.synced : null;

  return (
    <div className="grid max-w-5xl gap-6">
      <Notice searchParams={sp} />
      {synced && (
        <p role="status" className="rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
          Synced with Microsoft 365: {synced} staff found, {String(sp.added ?? 0)} new, {String(sp.off ?? 0)} switched off.
        </p>
      )}

      <Card title="Sync with Microsoft 365">
        <p className="mb-4 text-sm text-fp-dark/75">
          Everyone with a {staffDomains().map((d) => `@${d}`).join(" or ")} account in Microsoft 365 is listed in{" "}
          <Link href="/admin/users" className="font-semibold text-fp-teal-deep hover:underline">Users</Link> — even
          before they first sign in — with a role based on their job title. This runs automatically every morning.
          Anyone whose Microsoft account is switched off or removed is switched off here too.
        </p>
        {!configured ? (
          <p className="rounded-md bg-fp-amber/15 px-3 py-2 text-sm">
            Not connected yet: the Microsoft 365 app settings (<code>ENTRA_TENANT_ID</code>, <code>ENTRA_CLIENT_ID</code>,{" "}
            <code>ENTRA_CLIENT_SECRET</code>) haven&apos;t been added.
          </p>
        ) : (
          <form action={syncDirectoryNow}>
            <button type="submit" className={`${primaryButton} inline-flex items-center gap-2`}>
              <RefreshCw size={14} aria-hidden /> Sync now
            </button>
          </form>
        )}
        {(runs ?? []).length > 0 && (
          <ul className="mt-4 grid gap-1 border-t border-fp-border pt-3 text-sm">
            {(runs ?? []).map((r) => (
              <li key={r.id}>
                <span className="mr-2">
                  <Badge tone={r.status === "ok" ? "teal" : "red"}>{r.status === "ok" ? "OK" : "Failed"}</Badge>
                </span>
                {shortDateTime(r.ran_at)} · {r.trigger === "scheduled" ? "automatic" : "by an admin"}
                {r.status === "ok"
                  ? ` · ${r.users_seen} staff, ${r.added} new, ${r.switched_off} switched off`
                  : ` · ${r.error}`}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Job title rules">
        <p className="mb-4 text-sm text-fp-dark/75">
          Each rule gives a role to anyone whose job title contains some text, e.g. &ldquo;Sales&rdquo; → Sales. If more than
          one rule matches, the lowest priority number wins. You can also pick a role for one person on their page in Users,
          which overrides these rules. Admin rights are never given automatically.
        </p>
        {(rules ?? []).length > 0 && (
          <table className="mb-5 w-full text-left text-sm">
            <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
              <tr>
                <th className="py-2 pr-3 font-semibold">Job title contains</th>
                <th className="py-2 pr-3 font-semibold">Role</th>
                <th className="py-2 pr-3 font-semibold">Priority</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {(rules ?? []).map((r) => (
                <tr key={r.id} className="border-b border-fp-border last:border-0">
                  <td className="py-2 pr-3 font-semibold">&ldquo;{r.match_text}&rdquo;</td>
                  <td className="py-2 pr-3">{roleName.get(r.role_id)}</td>
                  <td className="py-2 pr-3">{r.priority}</td>
                  <td className="py-2 text-right">
                    <form action={deleteJobRoleRule.bind(null, r.id)}>
                      <button type="submit" className="inline-flex items-center gap-1 text-xs font-semibold text-fp-error hover:underline">
                        <Trash2 size={12} aria-hidden /> Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(roles ?? []).length === 0 ? (
          <p className="text-sm">
            First <Link href="/admin/roles" className="font-semibold text-fp-teal-deep hover:underline">create some roles</Link>.
          </p>
        ) : (
          <form action={addJobRoleRule} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_110px_auto]">
            <Field label="Job title contains">
              <input name="match_text" required className={inputClass} placeholder="e.g. Sales" />
            </Field>
            <Field label="Gets role">
              <select name="role_id" required className={inputClass} defaultValue="">
                <option value="" disabled>Choose a role…</option>
                {(roles ?? []).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <input name="priority" type="number" min={1} defaultValue={100} className={inputClass} />
            </Field>
            <button type="submit" className={primaryButton}>Add rule</button>
          </form>
        )}
      </Card>

      <Card title="Job titles in Microsoft 365">
        {titleRows.length === 0 ? (
          <p className="text-sm text-fp-dark/75">Nothing yet — run a sync to bring in the staff list.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
              <tr>
                <th className="py-2 pr-3 font-semibold">Job title</th>
                <th className="py-2 pr-3 font-semibold">People</th>
                <th className="py-2 font-semibold">Role from rules</th>
              </tr>
            </thead>
            <tbody>
              {titleRows.map((t) => (
                <tr key={t.title} className="border-b border-fp-border last:border-0">
                  <td className="py-2 pr-3">{t.title || <span className="text-fp-mid">(no job title)</span>}</td>
                  <td className="py-2 pr-3">{t.count}</td>
                  <td className="py-2">
                    {t.role ? roleName.get(t.role) : <Badge tone="amber">No rule — no access yet</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Automatic daily sync key">
        <SyncKeyCard keySetAt={settings?.key_set_at ? shortDateTime(settings.key_set_at) : null} />
      </Card>
    </div>
  );
}

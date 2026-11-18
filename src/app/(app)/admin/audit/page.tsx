import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Card } from "../ui";

const tableLabels: Record<string, string> = {
  profiles: "Users",
  teams: "Teams",
  team_members: "Team members",
  roles: "Roles",
  role_permissions: "Role permissions",
  user_roles: "User roles",
  customers: "Customers",
  contacts: "Contacts",
  hosting_plans: "Hosting plans",
  hosting_items: "Hosting lines",
  retainers: "Retainers",
  retainer_services: "Retainer services",
  customer_activity: "Timeline",
  sales_documents: "Quotes, orders & invoices",
  sales_document_lines: "Document lines",
  products: "Products",
  suppliers: "Suppliers",
  tax_rates: "VAT rates",
  company_settings: "Company details",
  number_sequences: "Numbering",
  purchase_orders: "Purchase orders",
  purchase_order_lines: "Purchase order lines",
  recurring_invoices: "Recurring invoices",
  recurring_invoice_lines: "Recurring invoice lines",
  projects: "Projects",
  project_tasks: "Project tasks",
  time_logs: "Time logs",
  project_templates: "Project templates",
  content_items: "Content calendar",
  ad_campaigns: "Ad campaigns",
  staff_directory: "Microsoft 365 staff",
  job_role_rules: "Job title rules",
  email_templates: "Email templates",
  monthly_targets: "Targets",
  commission_rules: "Commission rules",
  role_cost_rates: "Cost rates",
  roadmap_tasks: "Roadmap tasks",
  roadmap_waves: "Roadmap stages",
  feedback_requests: "Requests",
  sales_accounts: "Sales accounts",
};

// Bookkeeping columns that only add noise to the log.
const HIDDEN = new Set(["id", "updated_at", "updated_by", "created_at", "created_by", "search", "position"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "customer_id" → "Customer", "due_date" → "Due date".
const fieldLabel = (k: string) => {
  const s = k.replace(/_id$/, "").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// A value as a person would say it: names for people, Yes/No, "empty", short text.
function show(v: unknown, people: Map<string, string>): string {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") {
    if (UUID_RE.test(v)) return people.get(v) ?? "a linked record";
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });
    return v.length > 60 ? `“${v.slice(0, 57)}…”` : `“${v}”`;
  }
  if (typeof v === "number") return String(v);
  return Array.isArray(v) ? `${v.length} item${v.length === 1 ? "" : "s"}` : "details";
}

const actionLabels: Record<string, string> = {
  insert: "Added",
  update: "Changed",
  delete: "Removed",
  gdpr_export: "GDPR data export",
  gdpr_erase: "GDPR erasure",
};

// Shows what changed on an update (one line per field), or which record was
// added or removed, in plain words.
function describe(
  entry: {
    action: string;
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    record: Record<string, unknown> | null;
  },
  people: Map<string, string>,
): string[] {
  if (entry.record?.redacted) return ["Details removed (GDPR erasure)"];
  if (entry.action === "gdpr_export") return ["Personal data exported for a subject access request"];
  if (entry.action === "gdpr_erase") return ["Personal data erased on request"];
  if (entry.action === "update" && entry.old_data && entry.new_data) {
    const changes = Object.keys(entry.new_data)
      .filter((k) => !HIDDEN.has(k))
      .filter((k) => JSON.stringify(entry.old_data![k]) !== JSON.stringify(entry.new_data![k]))
      .map((k) => `${fieldLabel(k)}: ${show(entry.old_data![k], people)} → ${show(entry.new_data![k], people)}`);
    return changes.length ? changes : ["No visible change"];
  }
  const r = entry.record ?? {};
  const name = r.name ?? r.title ?? r.number ?? r.email ?? r.full_name ?? (r.feature ? `${r.feature}: ${r.action}` : null);
  if (name) return [String(name)];
  // No obvious name: show the first few meaningful fields.
  const parts = Object.keys(r)
    .filter((k) => !HIDDEN.has(k) && r[k] !== null && r[k] !== "")
    .slice(0, 3)
    .map((k) => `${fieldLabel(k)}: ${show(r[k], people)}`);
  return parts.length ? [parts.join(" · ")] : ["—"];
}

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requireAdmin();
  const { table } = await props.searchParams;
  const filter = typeof table === "string" && table in tableLabels ? table : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, at, actor_email, action, table_name, record, old_data, new_data")
    .order("at", { ascending: false })
    .limit(200);
  if (filter) query = query.eq("table_name", filter);
  const [{ data: entries }, { data: profiles }, { data: roles }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name, email"),
    supabase.from("roles").select("id, name"),
  ]);
  // Names for the IDs that turn up most: people and roles.
  const people = new Map([
    ...(profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? (p.email as string)] as const),
    ...(roles ?? []).map((r) => [r.id as string, `${r.name} (role)`] as const),
  ]);

  const time = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  });

  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/audit"
          className={`rounded-full px-3 py-1 font-semibold ${!filter ? "bg-fp-black text-white" : "bg-fp-light"}`}
        >
          Everything
        </Link>
        {Object.entries(tableLabels).map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/audit?table=${key}`}
            className={`rounded-full px-3 py-1 font-semibold ${filter === key ? "bg-fp-black text-white" : "bg-fp-light"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <p className="mb-4 text-sm text-fp-dark/75">The latest 200 changes, newest first. Entries can&apos;t be edited or deleted.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-fp-border text-xs uppercase tracking-wide text-fp-mid">
            <tr>
              <th className="py-2 pr-4 font-semibold">When</th>
              <th className="py-2 pr-4 font-semibold">Who</th>
              <th className="py-2 pr-4 font-semibold">What</th>
              <th className="py-2 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((e) => (
              <tr key={e.id} className="border-b border-fp-border align-top last:border-0">
                <td className="whitespace-nowrap py-3 pr-4">{time.format(new Date(e.at))}</td>
                <td className="py-3 pr-4">{e.actor_email ?? <span className="text-fp-mid">System</span>}</td>
                <td className="whitespace-nowrap py-3 pr-4">
                  {actionLabels[e.action] ?? e.action} · {tableLabels[e.table_name] ?? e.table_name}
                </td>
                <td className="py-3 text-fp-dark/80">
                  <ul className="grid gap-0.5">
                    {describe(e, people).map((line, i) => (
                      <li key={i} className="break-words">
                        {line}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
            {(entries ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-fp-mid">Nothing recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

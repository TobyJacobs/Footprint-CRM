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
};

const actionLabels: Record<string, string> = {
  insert: "Added",
  update: "Changed",
  delete: "Removed",
  gdpr_export: "GDPR data export",
  gdpr_erase: "GDPR erasure",
};

// Shows what changed on an update, or the record itself otherwise.
function describe(entry: {
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  record: Record<string, unknown> | null;
}) {
  if (entry.record?.redacted) return "Details removed (GDPR erasure)";
  if (entry.action === "gdpr_export") return "Personal data exported for a subject access request";
  if (entry.action === "gdpr_erase") return "Personal data erased on request";
  if (entry.action === "update" && entry.old_data && entry.new_data) {
    const changes = Object.keys(entry.new_data)
      .filter((k) => k !== "updated_at")
      .filter((k) => JSON.stringify(entry.old_data![k]) !== JSON.stringify(entry.new_data![k]))
      .map((k) => `${k}: ${JSON.stringify(entry.old_data![k])} → ${JSON.stringify(entry.new_data![k])}`);
    return changes.join("; ") || "No visible change";
  }
  const r = entry.record ?? {};
  const label = r.name ?? r.email ?? (r.feature ? `${r.feature}: ${r.action}` : null);
  return label ? String(label) : JSON.stringify(r);
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
  const { data: entries } = await query;

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
                <td className="break-all py-3 text-fp-dark/80">{describe(e)}</td>
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

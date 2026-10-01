"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { bool, dateTime, int, list, num, str } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Every action checks the person's "customers" permission and runs as them,
// so the database's own rules apply too.

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

// Collects numbered rows from a form, e.g. "web_0_domain", "web_1_domain".
function rows(fd: FormData, prefix: string): Map<number, Record<string, string>> {
  const out = new Map<number, Record<string, string>>();
  for (const [key, value] of fd.entries()) {
    const m = key.match(new RegExp(`^${prefix}_(\\d+)_(\\w+)$`));
    if (!m || typeof value !== "string") continue;
    const i = Number(m[1]);
    const row = out.get(i) ?? {};
    row[m[2]] = value.trim();
    out.set(i, row);
  }
  return out;
}

const blankToNull = (v: string | undefined) => (v && v !== "" ? v : null);
const toNumber = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// ─── Customers ──────────────────────────────────────────────────────────────

function customerFields(fd: FormData) {
  return {
    name: str(fd, "name"),
    parent_id: str(fd, "parent_id"),
    account_type: str(fd, "account_type"),
    status: str(fd, "status"),
    website: str(fd, "website"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    industry: str(fd, "industry"),
    ownership: str(fd, "ownership"),
    description: str(fd, "description"),
    owner_id: str(fd, "owner_id"),
    billing_street: str(fd, "billing_street"),
    billing_city: str(fd, "billing_city"),
    billing_county: str(fd, "billing_county"),
    billing_postcode: str(fd, "billing_postcode"),
    billing_country: str(fd, "billing_country"),
    shipping_street: str(fd, "shipping_street"),
    shipping_city: str(fd, "shipping_city"),
    shipping_county: str(fd, "shipping_county"),
    shipping_postcode: str(fd, "shipping_postcode"),
    shipping_country: str(fd, "shipping_country"),
    services: list(fd, "services"),
    heard_about_us: list(fd, "heard_about_us"),
    brochures_sent: list(fd, "brochures_sent"),
    credit_status: str(fd, "credit_status"),
    direct_debit_status: str(fd, "direct_debit_status"),
    direct_debit_status_fmn: str(fd, "direct_debit_status_fmn"),
    sales_discount_percent: num(fd, "sales_discount_percent"),
    invoice_due_days: int(fd, "invoice_due_days"),
    invoice_due_terms: str(fd, "invoice_due_terms"),
    default_sales_account: str(fd, "default_sales_account"),
    xero_contact_id: str(fd, "xero_contact_id"),
    date_last_ordered: str(fd, "date_last_ordered"),
    last_contacted_on: str(fd, "last_contacted_on"),
    follow_up_at: dateTime(fd, "follow_up_at"),
  };
}

export async function saveCustomer(customerId: string | null, fd: FormData) {
  await requirePermission("customers", "edit");
  const back = customerId ? `/customers/${customerId}/edit` : "/customers/new";
  const fields = customerFields(fd);
  if (!fields.name) fail(back, "Please enter the customer's name");
  if (customerId && fields.parent_id === customerId) fail(back, "A customer can't be its own parent");

  const supabase = await createClient();
  let id = customerId;
  if (customerId) {
    const { error } = await supabase.from("customers").update(fields).eq("id", customerId);
    if (error) fail(back, error.message);
  } else {
    const { data, error } = await supabase.from("customers").insert(fields).select("id").single();
    if (error) fail(back, error.message);
    id = data.id;
  }

  revalidatePath("/customers");
  redirect(`/customers/${id}?saved=1`);
}

export async function deleteCustomer(customerId: string) {
  await requirePermission("customers", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) fail(`/customers/${customerId}`, error.message);
  revalidatePath("/customers");
  redirect("/customers?deleted=1");
}

// ─── Contacts ───────────────────────────────────────────────────────────────

export async function saveContact(customerId: string, contactId: string | null, fd: FormData) {
  await requirePermission("customers", "edit");
  const back = contactId
    ? `/customers/${customerId}/contacts/${contactId}`
    : `/customers/${customerId}/contacts/new`;

  const fields = {
    customer_id: customerId,
    salutation: str(fd, "salutation"),
    first_name: str(fd, "first_name"),
    last_name: str(fd, "last_name"),
    job_title: str(fd, "job_title"),
    department: str(fd, "department"),
    email: str(fd, "email"),
    secondary_email: str(fd, "secondary_email"),
    phone: str(fd, "phone"),
    mobile: str(fd, "mobile"),
    home_phone: str(fd, "home_phone"),
    street: str(fd, "street"),
    city: str(fd, "city"),
    county: str(fd, "county"),
    postcode: str(fd, "postcode"),
    country: str(fd, "country"),
    is_primary: bool(fd, "is_primary"),
    financial_status: str(fd, "financial_status"),
    lead_source: str(fd, "lead_source"),
    email_opt_out: bool(fd, "email_opt_out"),
    // An opt-out always wins: never leave someone on a mailing list after they opt out.
    include_in_emails: bool(fd, "email_opt_out") ? false : bool(fd, "include_in_emails"),
    marketing_lists: bool(fd, "email_opt_out") ? [] : list(fd, "marketing_lists"),
    notes: str(fd, "notes"),
  };
  if (!fields.last_name) fail(back, "Please enter a last name (or the full name if there's only one)");

  const supabase = await createClient();
  let id = contactId;
  if (contactId) {
    const { error } = await supabase.from("contacts").update(fields).eq("id", contactId).eq("customer_id", customerId);
    if (error) fail(back, error.message);
  } else {
    const { data, error } = await supabase.from("contacts").insert(fields).select("id").single();
    if (error) fail(back, error.message);
    id = data.id;
  }

  // Only one primary contact per customer.
  if (fields.is_primary) {
    await supabase
      .from("contacts")
      .update({ is_primary: false })
      .eq("customer_id", customerId)
      .eq("is_primary", true)
      .neq("id", id!);
  }

  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?saved=1#contacts`);
}

export async function deleteContact(customerId: string, contactId: string) {
  await requirePermission("customers", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", contactId).eq("customer_id", customerId);
  if (error) fail(`/customers/${customerId}/contacts/${contactId}`, error.message);
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?deleted=1#contacts`);
}

// ─── Hosting plans ──────────────────────────────────────────────────────────

export async function saveHostingPlan(customerId: string, planId: string | null, fd: FormData) {
  await requirePermission("customers", "edit");
  const back = planId ? `/customers/${customerId}/hosting/${planId}` : `/customers/${customerId}/hosting/new`;

  const fields = {
    customer_id: customerId,
    name: str(fd, "name"),
    plan_type: str(fd, "plan_type"),
    status: str(fd, "status"),
    price: num(fd, "price"),
    billing_frequency: str(fd, "billing_frequency"),
    direct_debit: str(fd, "direct_debit"),
    renewal_month: str(fd, "renewal_month"),
    hours_included: bool(fd, "hours_included"),
    hosting_platform: str(fd, "hosting_platform"),
    admin_url: str(fd, "admin_url"),
    third_party_url: str(fd, "third_party_url"),
    third_party_username: str(fd, "third_party_username"),
    credentials_location: str(fd, "credentials_location"),
    notes: str(fd, "notes"),
  };
  if (!fields.name) fail(back, "Please give the hosting plan a name");

  const supabase = await createClient();
  let id = planId;
  if (planId) {
    const { error } = await supabase.from("hosting_plans").update(fields).eq("id", planId).eq("customer_id", customerId);
    if (error) fail(back, error.message);
  } else {
    const { data, error } = await supabase.from("hosting_plans").insert(fields).select("id").single();
    if (error) fail(back, error.message);
    id = data.id;
  }

  // Replace the plan's web and email hosting lines with what's on the form.
  const web = [...rows(fd, "web").values()]
    .filter((r) => r.plan || r.domain)
    .map((r) => ({
      hosting_plan_id: id!,
      kind: "web",
      plan: blankToNull(r.plan),
      domain: blankToNull(r.domain),
      included_hours: blankToNull(r.hours),
      on_20i: r.on20i === "on",
    }));
  const email = [...rows(fd, "email").values()]
    .filter((r) => r.qty || r.platform)
    .map((r) => ({
      hosting_plan_id: id!,
      kind: "email",
      mailbox_qty: toNumber(r.qty),
      email_platform: blankToNull(r.platform),
      footprint_hosted: r.footprint === "yes" ? true : r.footprint === "no" ? false : null,
    }));

  const { error: clearError } = await supabase.from("hosting_items").delete().eq("hosting_plan_id", id!);
  if (clearError) fail(back, clearError.message);
  if (web.length + email.length) {
    const { error: itemsError } = await supabase.from("hosting_items").insert([...web, ...email]);
    if (itemsError) fail(back, itemsError.message);
  }

  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?saved=1#hosting`);
}

export async function deleteHostingPlan(customerId: string, planId: string) {
  await requirePermission("customers", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("hosting_plans").delete().eq("id", planId).eq("customer_id", customerId);
  if (error) fail(`/customers/${customerId}/hosting/${planId}`, error.message);
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?deleted=1#hosting`);
}

// ─── Retainers ──────────────────────────────────────────────────────────────

export async function saveRetainer(customerId: string, retainerId: string | null, fd: FormData) {
  await requirePermission("customers", "edit");
  const back = retainerId
    ? `/customers/${customerId}/retainers/${retainerId}`
    : `/customers/${customerId}/retainers/new`;

  const fields = {
    customer_id: customerId,
    name: str(fd, "name"),
    status: str(fd, "status"),
    monthly_fee: num(fd, "monthly_fee"),
    budget_hours: int(fd, "budget_hours"),
    digital_am_id: str(fd, "digital_am_id"),
    sales_am_id: str(fd, "sales_am_id"),
    subscription_number: str(fd, "subscription_number"),
    notes: str(fd, "notes"),
    future_opportunity: str(fd, "future_opportunity"),
  };
  if (!fields.name) fail(back, "Please give the retainer a name");

  const supabase = await createClient();
  let id = retainerId;
  if (retainerId) {
    const { error } = await supabase.from("retainers").update(fields).eq("id", retainerId).eq("customer_id", customerId);
    if (error) fail(back, error.message);
  } else {
    const { data, error } = await supabase.from("retainers").insert(fields).select("id").single();
    if (error) fail(back, error.message);
    id = data.id;
  }

  const services = [...rows(fd, "svc").values()]
    .filter((r) => r.service)
    .map((r) => ({
      retainer_id: id!,
      service: r.service,
      qty_per_month: toNumber(r.qty),
      platforms: blankToNull(r.platforms),
      ad_spend: toNumber(r.spend),
      notes: blankToNull(r.notes),
    }));

  const { error: clearError } = await supabase.from("retainer_services").delete().eq("retainer_id", id!);
  if (clearError) fail(back, clearError.message);
  if (services.length) {
    const { error: svcError } = await supabase.from("retainer_services").insert(services);
    if (svcError) fail(back, svcError.message);
  }

  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?saved=1#retainers`);
}

export async function deleteRetainer(customerId: string, retainerId: string) {
  await requirePermission("customers", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("retainers").delete().eq("id", retainerId).eq("customer_id", customerId);
  if (error) fail(`/customers/${customerId}/retainers/${retainerId}`, error.message);
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?deleted=1#retainers`);
}

// ─── Timeline ───────────────────────────────────────────────────────────────

export async function addActivity(customerId: string, fd: FormData) {
  await requirePermission("customers", "edit");
  const body = str(fd, "body");
  if (!body) fail(`/customers/${customerId}#timeline`, "Please write something before adding it");

  const supabase = await createClient();
  const { error } = await supabase.from("customer_activity").insert({
    customer_id: customerId,
    contact_id: str(fd, "contact_id"),
    kind: str(fd, "kind") ?? "note",
    body,
    occurred_at: dateTime(fd, "occurred_at") ?? new Date().toISOString(),
  });
  if (error) fail(`/customers/${customerId}`, error.message);

  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}#timeline`);
}

export async function deleteActivity(customerId: string, activityId: string) {
  await requirePermission("customers", "delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_activity")
    .delete()
    .eq("id", activityId)
    .eq("customer_id", customerId);
  if (error) fail(`/customers/${customerId}`, error.message);
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}#timeline`);
}

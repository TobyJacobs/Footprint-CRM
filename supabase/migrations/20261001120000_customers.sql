-- Wave 1: customers, contacts, hosting plans, digital retainers and the
-- customer timeline.
--
-- Plain-English summary:
-- * `customers` replaces Zoho CRM Accounts; `contacts` replaces Zoho Contacts.
-- * `hosting_plans` (+ `hosting_items` for each web/email hosting line) and
--   `retainers` (+ `retainer_services`) replace the custom Zoho modules.
-- * `customer_activity` is each customer's timeline (notes for now).
-- * Who can do what is controlled by the "customers" permission:
--   view → read, edit → add and change, delete → remove.
-- * Picklist options (status, credit status, services…) are plain text using
--   the same wording as Zoho; the app checks them, so new options don't need
--   a database change.
-- * `zoho_id` remembers each record's Zoho ID so imports can be re-run safely.
-- * Every change is written to the audit log.
-- * Third-party passwords are deliberately NOT stored (see DECISIONS.md).

create extension if not exists pg_trgm with schema extensions;

-- Keeps updated_at / updated_by current on every change.
create function public.touch_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- ─── Customers ──────────────────────────────────────────────────────────────

create table public.customers (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null check (length(trim(name)) > 0),
  parent_id              uuid references public.customers (id) on delete set null,
  account_type           text,
  status                 text,
  website                text,
  phone                  text,
  email                  text,
  industry               text,
  ownership              text,
  description            text,
  owner_id               uuid references public.profiles (id) on delete set null,

  billing_street         text,
  billing_city           text,
  billing_county         text,
  billing_postcode       text,
  billing_country        text,
  shipping_street        text,
  shipping_city          text,
  shipping_county        text,
  shipping_postcode      text,
  shipping_country       text,

  services               text[] not null default '{}',
  heard_about_us         text[] not null default '{}',
  brochures_sent         text[] not null default '{}',

  credit_status          text,
  direct_debit_status    text,
  direct_debit_status_fmn text,
  sales_discount_percent numeric(5,2),
  invoice_due_days       integer,
  invoice_due_terms      text,
  default_sales_account  text,
  xero_contact_id        text,

  date_last_ordered      date,
  last_contacted_on      date,
  follow_up_at           timestamptz,

  zoho_id                text unique,
  created_at             timestamptz not null default now(),
  created_by             uuid default auth.uid(),
  updated_at             timestamptz not null default now(),
  updated_by             uuid
);

create index customers_name_trgm on public.customers using gin (name extensions.gin_trgm_ops);
create index customers_status_idx on public.customers (status);
create index customers_services_idx on public.customers using gin (services);
create index customers_parent_idx on public.customers (parent_id);

-- ─── Contacts ───────────────────────────────────────────────────────────────

create table public.contacts (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid references public.customers (id) on delete cascade,
  salutation          text,
  first_name          text,
  last_name           text not null check (length(trim(last_name)) > 0),
  job_title           text,
  department          text,
  email               text,
  secondary_email     text,
  phone               text,
  mobile              text,
  home_phone          text,
  street              text,
  city                text,
  county              text,
  postcode            text,
  country             text,
  is_primary          boolean not null default false,
  financial_status    text,
  lead_source         text,
  reports_to_id       uuid references public.contacts (id) on delete set null,
  -- Marketing consent (UK GDPR): an explicit opt-out wins over everything.
  email_opt_out       boolean not null default false,
  include_in_emails   boolean not null default false,
  marketing_lists     text[] not null default '{}',
  notes               text,

  zoho_id             text unique,
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid
);

create index contacts_customer_idx on public.contacts (customer_id);
create index contacts_name_trgm on public.contacts
  using gin ((coalesce(first_name, '') || ' ' || last_name) extensions.gin_trgm_ops);
create index contacts_email_idx on public.contacts (lower(email));

-- ─── Hosting plans ──────────────────────────────────────────────────────────

create table public.hosting_plans (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers (id) on delete cascade,
  name                  text not null check (length(trim(name)) > 0),
  plan_type             text,
  status                text,
  price                 numeric(10,2),
  billing_frequency     text,
  direct_debit          text,
  renewal_month         text,
  hours_included        boolean not null default false,
  hosting_platform      text,
  admin_url             text,
  third_party_url       text,
  third_party_username  text,
  -- Where the login is kept (e.g. "1Password: Client name – hosting").
  -- Passwords themselves are never stored here.
  credentials_location  text,
  notes                 text,

  zoho_id               text unique,
  created_at            timestamptz not null default now(),
  created_by            uuid default auth.uid(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid
);

create index hosting_plans_customer_idx on public.hosting_plans (customer_id);

-- One row per web-hosting or email-hosting line on a plan.
create table public.hosting_items (
  id                uuid primary key default gen_random_uuid(),
  hosting_plan_id   uuid not null references public.hosting_plans (id) on delete cascade,
  kind              text not null check (kind in ('web', 'email')),
  -- web
  plan              text,
  domain            text,
  included_hours    text,
  on_20i            boolean not null default false,
  -- email
  mailbox_qty       integer,
  email_platform    text,
  footprint_hosted  boolean,

  zoho_id           text unique,
  created_at        timestamptz not null default now()
);

create index hosting_items_plan_idx on public.hosting_items (hosting_plan_id);

-- ─── Digital retainers ──────────────────────────────────────────────────────

create table public.retainers (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references public.customers (id) on delete cascade,
  name                 text not null check (length(trim(name)) > 0),
  status               text,
  monthly_fee          numeric(10,2),
  budget_hours         integer,
  digital_am_id        uuid references public.profiles (id) on delete set null,
  sales_am_id          uuid references public.profiles (id) on delete set null,
  subscription_number  text,
  notes                text,
  future_opportunity   text,

  zoho_id              text unique,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid
);

create index retainers_customer_idx on public.retainers (customer_id);

create table public.retainer_services (
  id             uuid primary key default gen_random_uuid(),
  retainer_id    uuid not null references public.retainers (id) on delete cascade,
  service        text not null,
  qty_per_month  integer,
  platforms      text,
  ad_spend       numeric(10,2),
  notes          text,

  zoho_id        text unique,
  created_at     timestamptz not null default now()
);

create index retainer_services_retainer_idx on public.retainer_services (retainer_id);

-- ─── Timeline ───────────────────────────────────────────────────────────────

create table public.customer_activity (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  contact_id   uuid references public.contacts (id) on delete set null,
  kind         text not null default 'note' check (kind in ('note', 'call', 'email', 'meeting', 'system')),
  body         text not null check (length(trim(body)) > 0),
  occurred_at  timestamptz not null default now(),
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  zoho_id      text unique,
  created_at   timestamptz not null default now()
);

create index customer_activity_customer_idx on public.customer_activity (customer_id, occurred_at desc);

-- ─── updated_at / audit triggers ────────────────────────────────────────────

create trigger customers_touch before update on public.customers
  for each row execute function public.touch_row();
create trigger contacts_touch before update on public.contacts
  for each row execute function public.touch_row();
create trigger hosting_plans_touch before update on public.hosting_plans
  for each row execute function public.touch_row();
create trigger retainers_touch before update on public.retainers
  for each row execute function public.touch_row();

create trigger audit_customers after insert or update or delete on public.customers
  for each row execute function public.audit_row();
create trigger audit_contacts after insert or update or delete on public.contacts
  for each row execute function public.audit_row();
create trigger audit_hosting_plans after insert or update or delete on public.hosting_plans
  for each row execute function public.audit_row();
create trigger audit_hosting_items after insert or update or delete on public.hosting_items
  for each row execute function public.audit_row();
create trigger audit_retainers after insert or update or delete on public.retainers
  for each row execute function public.audit_row();
create trigger audit_retainer_services after insert or update or delete on public.retainer_services
  for each row execute function public.audit_row();
create trigger audit_customer_activity after insert or update or delete on public.customer_activity
  for each row execute function public.audit_row();

-- ─── Row-level security: the "customers" permission ─────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'contacts', 'hosting_plans', 'hosting_items',
    'retainers', 'retainer_services', 'customer_activity'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "View customers" on public.%I for select to authenticated using (public.has_permission(''customers'', ''view''))', t);
    execute format(
      'create policy "Add customers" on public.%I for insert to authenticated with check (public.has_permission(''customers'', ''edit''))', t);
    execute format(
      'create policy "Change customers" on public.%I for update to authenticated using (public.has_permission(''customers'', ''edit'')) with check (public.has_permission(''customers'', ''edit''))', t);
    execute format(
      'create policy "Remove customers" on public.%I for delete to authenticated using (public.has_permission(''customers'', ''delete''))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

revoke execute on function public.touch_row() from anon, public;

-- Wave 2a: quote to invoice.
--
-- Plain-English summary:
-- * `tax_rates`, `suppliers` and `products` are the price list.
-- * `sales_documents` holds quotes, sales orders and invoices in one table
--   (they share almost everything); `sales_document_lines` holds their lines.
--   Each line keeps its own price, cost and VAT rate at the time, so later
--   price-list changes never alter an old document.
-- * Totals (net, VAT, total, cost, gross profit) are worked out by the
--   database from the lines, so they can't drift out of step.
-- * `number_sequences` hands out QT-/SO-/INV- numbers one at a time with no
--   gaps or duplicates, continuing from Zoho's numbers.
-- * `company_settings` holds Footprint's details for documents (address, VAT
--   number, bank details for invoices) — kept in the database, not the code.
-- * Customers approve quotes through a private link: two small functions let
--   someone holding the link (and only that) view the quote and accept or
--   decline it. Nothing else is visible without signing in.
-- * Permission: the "quotes" feature (view / edit / delete). Company settings
--   are admin-only.

-- ─── Price list ─────────────────────────────────────────────────────────────

create table public.tax_rates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  rate        numeric(5,2) not null check (rate >= 0),
  is_default  boolean not null default false,
  active      boolean not null default true,
  zoho_id     text unique,
  created_at  timestamptz not null default now()
);

insert into public.tax_rates (name, rate, is_default) values
  ('VAT 20%', 20, true),
  ('VAT 5%', 5, false),
  ('Zero rated', 0, false),
  ('Exempt', 0, false),
  ('No VAT', 0, false),
  ('Zero rated EC goods', 0, false),
  ('Zero rated EC services', 0, false);

create table public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  email       text,
  phone       text,
  address     text,
  notes       text,
  active      boolean not null default true,
  zoho_id     text unique,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

insert into public.suppliers (name) values
  ('Footprint'), ('Footprint Design Service'), ('Cafe Menu Systems'), ('Colour Graphics'),
  ('Digiprint'), ('Marqet Space'), ('Metal Magnetic Badges'), ('Pencarrie');

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  description  text,
  sku          text,
  unit         text,
  sale_price   numeric(12,2) not null default 0,
  cost_price   numeric(12,2),
  supplier_id  uuid references public.suppliers (id) on delete set null,
  tax_rate_id  uuid references public.tax_rates (id) on delete set null,
  business_unit text,
  active       boolean not null default true,
  zoho_id      text unique,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);

create index products_name_trgm on public.products using gin (name extensions.gin_trgm_ops);

-- ─── Numbering ──────────────────────────────────────────────────────────────

create table public.number_sequences (
  doc_type     text primary key,
  prefix       text not null,
  next_number  bigint not null,
  padding      integer not null default 6
);

-- Starts from Zoho's next numbers (1 October 2026); updated again at cut-over.
insert into public.number_sequences (doc_type, prefix, next_number, padding) values
  ('quote', 'QT-', 9972, 6),
  ('sales_order', 'SO-', 10913, 6),
  ('invoice', 'INV-', 74891, 6),
  ('purchase_order', 'PO-', 3271, 5),
  ('credit_note', 'CN-', 9, 5);

-- Hands out the next number for a document type, safely even if two people
-- save at the same moment.
create function public.next_document_number(p_doc_type text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  s public.number_sequences%rowtype;
begin
  if not public.has_permission('quotes', 'edit') then
    raise exception 'Not allowed';
  end if;
  update public.number_sequences
     set next_number = next_number + 1
   where doc_type = p_doc_type
  returning * into s;
  if not found then
    raise exception 'Unknown document type %', p_doc_type;
  end if;
  return s.prefix || lpad((s.next_number - 1)::text, s.padding, '0');
end;
$$;

-- ─── Company settings (one row) ─────────────────────────────────────────────

create table public.company_settings (
  id                 boolean primary key default true check (id),
  company_name       text not null default 'Footprint Group',
  legal_name         text,
  address            text,
  phone              text,
  email              text,
  website            text,
  vat_number         text,
  company_number     text,
  bank_details       text,
  quote_terms        text,
  order_terms        text,
  invoice_notes      text,
  invoice_terms      text,
  quote_valid_days   integer not null default 30,
  invoice_due_days   integer not null default 30,
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);

insert into public.company_settings (id, company_name, invoice_terms, order_terms)
values (
  true,
  'Footprint Group',
  'You can view our terms and conditions via this link: https://footprintsouth.co.uk/terms-and-conditions/',
  'You can view our terms and conditions via this link: https://footprintsouth.co.uk/terms-and-conditions/'
);

-- ─── Quotes, sales orders and invoices ─────────────────────────────────────

create table public.sales_documents (
  id                  uuid primary key default gen_random_uuid(),
  doc_type            text not null check (doc_type in ('quote', 'sales_order', 'invoice')),
  number              text not null unique,
  status              text not null default 'draft',
  customer_id         uuid not null references public.customers (id) on delete restrict,
  contact_id          uuid references public.contacts (id) on delete set null,
  owner_id            uuid references public.profiles (id) on delete set null,
  source_document_id  uuid references public.sales_documents (id) on delete set null,

  title               text,
  customer_reference  text,
  issue_date          date not null default current_date,
  valid_until         date,
  due_date            date,

  notes               text,
  terms               text,
  internal_notes      text,

  -- Footprint's own details (from Zoho)
  business_unit       text,
  probability         text,
  expected_date       text,
  delivery_type       text,
  reason_for_loss     text,
  labour_cost         numeric(12,2),
  deadline_date       date,
  production_step     text,
  copy_shop_job       boolean not null default false,
  consumer_copy_shop  boolean not null default false,
  copy_shop_minutes   integer,
  collected           boolean not null default false,

  -- Totals, kept up to date from the lines by the database
  subtotal            numeric(12,2) not null default 0,
  vat_total           numeric(12,2) not null default 0,
  total               numeric(12,2) not null default 0,
  cost_total          numeric(12,2) not null default 0,

  -- Sending and online approval
  sent_at             timestamptz,
  public_token        uuid not null unique default gen_random_uuid(),
  responded_at        timestamptz,
  response_name       text,
  response_po         text,
  response_note       text,
  response_ip         text,

  zoho_id             text unique,
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid
);

create index sales_documents_type_idx on public.sales_documents (doc_type, issue_date desc);
create index sales_documents_customer_idx on public.sales_documents (customer_id);
create index sales_documents_status_idx on public.sales_documents (doc_type, status);
create index sales_documents_source_idx on public.sales_documents (source_document_id);

create table public.sales_document_lines (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references public.sales_documents (id) on delete cascade,
  position          integer not null default 0,
  product_id        uuid references public.products (id) on delete set null,
  description       text not null default '',
  quantity          numeric(12,3) not null default 1,
  unit_price        numeric(12,2) not null default 0,
  unit_cost         numeric(12,2),
  discount_percent  numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  tax_rate_id       uuid references public.tax_rates (id) on delete set null,
  tax_rate          numeric(5,2) not null default 0,
  line_net          numeric(12,2) generated always as (round(quantity * unit_price * (1 - discount_percent / 100), 2)) stored,
  line_vat          numeric(12,2) generated always as (round(round(quantity * unit_price * (1 - discount_percent / 100), 2) * tax_rate / 100, 2)) stored,
  line_cost         numeric(12,2) generated always as (round(quantity * coalesce(unit_cost, 0), 2)) stored,
  created_at        timestamptz not null default now()
);

create index sales_document_lines_doc_idx on public.sales_document_lines (document_id, position);

-- Recalculate a document's totals whenever its lines change.
create function public.recalc_sales_document()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  doc uuid := coalesce(new.document_id, old.document_id);
begin
  update public.sales_documents d set
    subtotal   = coalesce((select sum(line_net) from public.sales_document_lines where document_id = doc), 0),
    vat_total  = coalesce((select sum(line_vat) from public.sales_document_lines where document_id = doc), 0),
    total      = coalesce((select sum(line_net + line_vat) from public.sales_document_lines where document_id = doc), 0),
    cost_total = coalesce((select sum(line_cost) from public.sales_document_lines where document_id = doc), 0)
  where d.id = doc;
  return null;
end;
$$;

create trigger sales_document_lines_recalc
  after insert or update or delete on public.sales_document_lines
  for each row execute function public.recalc_sales_document();

-- ─── updated_at and audit ───────────────────────────────────────────────────

create trigger suppliers_touch before update on public.suppliers for each row execute function public.touch_row();
create trigger products_touch before update on public.products for each row execute function public.touch_row();
create trigger sales_documents_touch before update on public.sales_documents for each row execute function public.touch_row();

create function public.touch_company_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger company_settings_touch before update on public.company_settings
  for each row execute function public.touch_company_settings();

create trigger audit_tax_rates after insert or update or delete on public.tax_rates for each row execute function public.audit_row();
create trigger audit_suppliers after insert or update or delete on public.suppliers for each row execute function public.audit_row();
create trigger audit_products after insert or update or delete on public.products for each row execute function public.audit_row();
create trigger audit_sales_documents after insert or update or delete on public.sales_documents for each row execute function public.audit_row();
create trigger audit_sales_document_lines after insert or update or delete on public.sales_document_lines for each row execute function public.audit_row();
create trigger audit_company_settings after update on public.company_settings for each row execute function public.audit_row();
create trigger audit_number_sequences after update on public.number_sequences for each row execute function public.audit_row();

-- ─── Row-level security ─────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['tax_rates', 'suppliers', 'products', 'sales_documents', 'sales_document_lines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "View sales" on public.%I for select to authenticated using (public.has_permission(''quotes'', ''view''))', t);
    execute format('create policy "Add sales" on public.%I for insert to authenticated with check (public.has_permission(''quotes'', ''edit''))', t);
    execute format('create policy "Change sales" on public.%I for update to authenticated using (public.has_permission(''quotes'', ''edit'')) with check (public.has_permission(''quotes'', ''edit''))', t);
    execute format('create policy "Remove sales" on public.%I for delete to authenticated using (public.has_permission(''quotes'', ''delete''))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

alter table public.number_sequences enable row level security;
create policy "View numbering" on public.number_sequences for select to authenticated using (public.has_permission('quotes', 'view'));
create policy "Admins change numbering" on public.number_sequences for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.number_sequences from anon;

alter table public.company_settings enable row level security;
create policy "Staff can read company details" on public.company_settings for select to authenticated using (public.is_active_user());
create policy "Admins change company details" on public.company_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.company_settings from anon;

-- ─── Online quote approval (the only thing visible without signing in) ──────

-- Everything the customer needs to see on the approval page, found by the
-- private token. Returns null if the token doesn't match a sent quote.
create function public.get_quote_by_token(p_token uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'number', d.number,
    'title', d.title,
    'status', d.status,
    'issue_date', d.issue_date,
    'valid_until', d.valid_until,
    'customer_reference', d.customer_reference,
    'notes', d.notes,
    'terms', d.terms,
    'subtotal', d.subtotal,
    'vat_total', d.vat_total,
    'total', d.total,
    'responded_at', d.responded_at,
    'response_name', d.response_name,
    'customer_name', c.name,
    'contact_name', nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'description', l.description, 'quantity', l.quantity, 'unit_price', l.unit_price,
               'discount_percent', l.discount_percent, 'tax_rate', l.tax_rate,
               'line_net', l.line_net) order by l.position)
        from public.sales_document_lines l where l.document_id = d.id), '[]'::jsonb),
    'company', (select jsonb_build_object(
                  'company_name', s.company_name, 'address', s.address, 'phone', s.phone,
                  'email', s.email, 'website', s.website, 'vat_number', s.vat_number,
                  'company_number', s.company_number)
                  from public.company_settings s)
  )
  from public.sales_documents d
  join public.customers c on c.id = d.customer_id
  left join public.contacts p on p.id = d.contact_id
  where d.public_token = p_token
    and d.doc_type = 'quote'
    and d.status in ('sent', 'accepted', 'declined', 'converted');
$$;

-- The customer's answer. Only works once, only for a sent quote that hasn't expired.
create function public.respond_to_quote(
  p_token uuid, p_accept boolean, p_name text, p_po text, p_note text, p_ip text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  d public.sales_documents%rowtype;
begin
  if p_name is null or length(trim(p_name)) < 2 then
    return 'Please type your name.';
  end if;

  select * into d from public.sales_documents
   where public_token = p_token and doc_type = 'quote'
   for update;
  if not found then
    return 'This quote link is not valid.';
  end if;
  if d.status <> 'sent' then
    return 'This quote has already been answered.';
  end if;
  if d.valid_until is not null and d.valid_until < current_date then
    return 'This quote has expired. Please contact us for an updated quote.';
  end if;

  update public.sales_documents set
    status = case when p_accept then 'accepted' else 'declined' end,
    responded_at = now(),
    response_name = left(trim(p_name), 200),
    response_po = nullif(left(trim(coalesce(p_po, '')), 100), ''),
    response_note = nullif(left(trim(coalesce(p_note, '')), 2000), ''),
    response_ip = left(p_ip, 100)
  where id = d.id;

  insert into public.customer_activity (customer_id, contact_id, kind, body)
  values (d.customer_id, d.contact_id, 'system',
          'Quote ' || d.number || ' was ' || case when p_accept then 'ACCEPTED' else 'declined' end ||
          ' online by ' || left(trim(p_name), 200) ||
          coalesce(' (customer PO: ' || nullif(trim(coalesce(p_po, '')), '') || ')', '') || '.');
  return null;
end;
$$;

revoke execute on function public.next_document_number(text) from anon, public;
revoke execute on function public.recalc_sales_document() from anon, public;
revoke execute on function public.touch_company_settings() from anon, public;
revoke execute on function public.get_quote_by_token(uuid) from public;
revoke execute on function public.respond_to_quote(uuid, boolean, text, text, text, text) from public;
grant execute on function public.next_document_number(text) to authenticated;
grant execute on function public.get_quote_by_token(uuid) to anon, authenticated;
grant execute on function public.respond_to_quote(uuid, boolean, text, text, text, text) to anon, authenticated;

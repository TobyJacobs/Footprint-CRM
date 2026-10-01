-- Wave 2b: purchase orders to suppliers, and credit notes.
--
-- Plain-English summary:
-- * Credit notes are customer documents like invoices, so they live in
--   `sales_documents` (doc_type 'credit_note'), raised from an invoice and
--   linked back to it. They carry a reason.
-- * Purchase orders go to suppliers, so they have their own tables
--   (`purchase_orders` + `purchase_order_lines`) with the same safeguards:
--   numbering continuing Zoho's PO- series, totals worked out by the database,
--   audit log, and the "quotes" permission.
-- * A purchase order can be linked to the sales order it was raised for.
-- * Suppliers gain a contact name and account reference for printed POs.

-- ─── Credit notes ───────────────────────────────────────────────────────────

alter table public.sales_documents drop constraint sales_documents_doc_type_check;
alter table public.sales_documents add constraint sales_documents_doc_type_check
  check (doc_type in ('quote', 'sales_order', 'invoice', 'credit_note'));
alter table public.sales_documents add column credit_reason text;

-- ─── Suppliers ──────────────────────────────────────────────────────────────

alter table public.suppliers add column contact_name text;
alter table public.suppliers add column account_reference text;

-- ─── Purchase orders ────────────────────────────────────────────────────────

create table public.purchase_orders (
  id                  uuid primary key default gen_random_uuid(),
  number              text not null unique,
  status              text not null default 'draft'
                      check (status in ('draft', 'sent', 'received', 'closed', 'cancelled')),
  supplier_id         uuid not null references public.suppliers (id) on delete restrict,
  sales_document_id   uuid references public.sales_documents (id) on delete set null,
  customer_id         uuid references public.customers (id) on delete set null,
  owner_id            uuid references public.profiles (id) on delete set null,
  issue_date          date not null default current_date,
  expected_date       date,
  supplier_reference  text,
  deliver_to          text,
  notes               text,
  internal_notes      text,
  subtotal            numeric(12,2) not null default 0,
  vat_total           numeric(12,2) not null default 0,
  total               numeric(12,2) not null default 0,
  sent_at             timestamptz,
  received_at         timestamptz,
  zoho_id             text unique,
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid
);

create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id, issue_date desc);
create index purchase_orders_sales_doc_idx on public.purchase_orders (sales_document_id);
create index purchase_orders_status_idx on public.purchase_orders (status, issue_date desc);

create table public.purchase_order_lines (
  id                 uuid primary key default gen_random_uuid(),
  purchase_order_id  uuid not null references public.purchase_orders (id) on delete cascade,
  position           integer not null default 0,
  product_id         uuid references public.products (id) on delete set null,
  description        text not null default '',
  quantity           numeric(12,3) not null default 1,
  unit_cost          numeric(12,2) not null default 0,
  tax_rate_id        uuid references public.tax_rates (id) on delete set null,
  tax_rate           numeric(5,2) not null default 0,
  line_net           numeric(12,2) generated always as (round(quantity * unit_cost, 2)) stored,
  line_vat           numeric(12,2) generated always as (round(round(quantity * unit_cost, 2) * tax_rate / 100, 2)) stored,
  created_at         timestamptz not null default now()
);

create index purchase_order_lines_po_idx on public.purchase_order_lines (purchase_order_id, position);

create function public.recalc_purchase_order()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  po uuid := coalesce(new.purchase_order_id, old.purchase_order_id);
begin
  update public.purchase_orders p set
    subtotal  = coalesce((select sum(line_net) from public.purchase_order_lines where purchase_order_id = po), 0),
    vat_total = coalesce((select sum(line_vat) from public.purchase_order_lines where purchase_order_id = po), 0),
    total     = coalesce((select sum(line_net + line_vat) from public.purchase_order_lines where purchase_order_id = po), 0)
  where p.id = po;
  return null;
end;
$$;

create trigger purchase_order_lines_recalc
  after insert or update or delete on public.purchase_order_lines
  for each row execute function public.recalc_purchase_order();

create trigger purchase_orders_touch before update on public.purchase_orders
  for each row execute function public.touch_row();

create trigger audit_purchase_orders after insert or update or delete on public.purchase_orders
  for each row execute function public.audit_row();
create trigger audit_purchase_order_lines after insert or update or delete on public.purchase_order_lines
  for each row execute function public.audit_row();

do $$
declare
  t text;
begin
  foreach t in array array['purchase_orders', 'purchase_order_lines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "View purchasing" on public.%I for select to authenticated using (public.has_permission(''quotes'', ''view''))', t);
    execute format('create policy "Add purchasing" on public.%I for insert to authenticated with check (public.has_permission(''quotes'', ''edit''))', t);
    execute format('create policy "Change purchasing" on public.%I for update to authenticated using (public.has_permission(''quotes'', ''edit'')) with check (public.has_permission(''quotes'', ''edit''))', t);
    execute format('create policy "Remove purchasing" on public.%I for delete to authenticated using (public.has_permission(''quotes'', ''delete''))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

revoke execute on function public.recalc_purchase_order() from anon, public;

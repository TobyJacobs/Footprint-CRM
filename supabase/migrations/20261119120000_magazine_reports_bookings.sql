-- Magazine reports, group 1: bookings and financial (1 November 2026).
-- Replaces Mag Manager's booking and financial reports (the director uses
-- all of them).
--
-- Plain-English summary:
-- * New lists in Magazines → Setup: advertiser categories (e.g. Trades,
--   Food & Drink) and magazine sections. A customer can have a category; an
--   advert can have a section and a premium position (e.g. Back cover).
--   Quotes keep them when they become orders.
-- * Bookings report: every advert on a sales order that isn't cancelled, by
--   issue month, for grouping by issue, salesperson, customer, category,
--   section, size or premium position. Needs Magazines view (like Magazine MI).
-- * Invoice report and VAT (cash accounting) run as the person asking, so
--   sales staff only see their own customers' documents, as everywhere else.
--   VAT on a cash basis counts invoices when they're marked paid and credit
--   notes when issued (part payments aren't recorded in FootprintOS yet).

create table public.magazine_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) between 1 and 80),
  position    integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table public.magazine_sections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) between 1 and 80),
  position    integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

do $$
declare t text;
begin
  foreach t in array array['magazine_categories', 'magazine_sections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "View magazines" on public.%I for select to authenticated using ((select public.has_permission(''magazines'', ''view'')) or (select public.has_permission(''quotes'', ''view'')) or (select public.has_permission(''customers'', ''view'')))', t);
    execute format('create policy "Add magazines" on public.%I for insert to authenticated with check ((select public.has_permission(''magazines'', ''edit'')))', t);
    execute format('create policy "Change magazines" on public.%I for update to authenticated using ((select public.has_permission(''magazines'', ''edit''))) with check ((select public.has_permission(''magazines'', ''edit'')))', t);
    execute format('create policy "Remove magazines" on public.%I for delete to authenticated using ((select public.has_permission(''magazines'', ''delete'')))', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_row()', t || '_touch', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'audit_' || t, t);
  end loop;
end $$;

alter table public.customers
  add column magazine_category_id uuid references public.magazine_categories (id) on delete set null;
create index customers_magazine_category_idx on public.customers (magazine_category_id) where magazine_category_id is not null;

alter table public.sales_document_lines
  add column magazine_section_id uuid references public.magazine_sections (id) on delete set null,
  add column premium_position text check (premium_position is null or premium_position in
    ('Front cover', 'Back cover', 'Inside front cover', 'Inside back cover', 'First page', 'Centre spread', 'Facing editorial'));
create index sales_document_lines_section_idx on public.sales_document_lines (magazine_section_id) where magazine_section_id is not null;

-- ─── Quotes accepted online keep the section and premium position ───────────

create or replace function public._convert_quote_to_order(p_quote_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  q public.sales_documents%rowtype;
  s public.company_settings%rowtype;
  num text;
  so uuid;
begin
  select * into q from public.sales_documents where id = p_quote_id and doc_type = 'quote' for update;
  if not found then
    raise exception 'Quote not found';
  end if;
  select * into s from public.company_settings limit 1;
  num := public._take_document_number('sales_order');

  insert into public.sales_documents (
    doc_type, number, status, customer_id, contact_id, owner_id, source_document_id,
    title, customer_reference, issue_date, business_unit, delivery_type, labour_cost,
    production_step, deadline_date, notes, terms, internal_notes
  ) values (
    'sales_order', num, 'open', q.customer_id, q.contact_id, q.owner_id, q.id,
    q.title, coalesce(q.response_po, q.customer_reference), current_date, q.business_unit,
    q.delivery_type, q.labour_cost, 'New Sales Order', q.deadline_date, q.notes,
    coalesce(s.order_terms, q.terms), q.internal_notes
  ) returning id into so;

  perform set_config('app.copying_overrides', '1', true);
  insert into public.sales_document_lines
    (document_id, position, product_id, description, quantity, unit_price, unit_cost, discount_percent, tax_rate_id, tax_rate,
     gp_override, gp_override_reason, gp_override_by, gp_override_at, magazine_issue_id, advert_size_id,
     magazine_section_id, premium_position)
  select so, l.position, l.product_id, l.description, l.quantity, l.unit_price, l.unit_cost, l.discount_percent, l.tax_rate_id, l.tax_rate,
         l.gp_override, l.gp_override_reason, l.gp_override_by, l.gp_override_at, l.magazine_issue_id, l.advert_size_id,
         l.magazine_section_id, l.premium_position
    from public.sales_document_lines l
   where l.document_id = q.id;
  perform set_config('app.copying_overrides', '0', true);

  update public.sales_documents set status = 'converted' where id = q.id;

  insert into public.customer_activity (customer_id, contact_id, kind, body)
  values (q.customer_id, q.contact_id, 'system',
          'Sales order ' || num || ' created automatically from accepted quote ' || q.number || '.');
  return so;
end;
$$;

revoke execute on function public._convert_quote_to_order(uuid) from anon, authenticated, public;

-- ─── Bookings ───────────────────────────────────────────────────────────────
-- One row per advert booked (sales orders not cancelled) in issues from
-- p_from's month to p_to's month.
create function public.report_bookings(p_from date, p_to date)
returns table (
  line_id uuid, month date, edition_code text, edition_name text,
  customer_id uuid, customer_name text, category text, section text, size text,
  premium_position text, salesperson text, net numeric, pages numeric,
  order_id uuid, order_number text, invoiced boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_permission('magazines', 'view') then
    raise exception 'Not allowed';
  end if;
  return query
    select l.id, i.month, e.code, e.name, d.customer_id, c.name, mc.name, ms.name, sz.name,
           l.premium_position, coalesce(p.full_name, p.email), l.line_net,
           coalesce(sz.page_fraction, 0) * l.quantity, d.id, d.number, l.invoiced_document_id is not null
      from public.sales_document_lines l
      join public.magazine_issues i on i.id = l.magazine_issue_id
      join public.magazine_editions e on e.id = i.edition_id
      join public.sales_documents d on d.id = l.document_id
      left join public.customers c on c.id = d.customer_id
      left join public.magazine_categories mc on mc.id = c.magazine_category_id
      left join public.magazine_sections ms on ms.id = l.magazine_section_id
      left join public.advert_sizes sz on sz.id = l.advert_size_id
      left join public.profiles p on p.id = d.owner_id
     where d.doc_type = 'sales_order' and d.status <> 'cancelled'
       and i.month between date_trunc('month', p_from)::date and date_trunc('month', p_to)::date
     order by i.month, e.code, c.name;
end;
$$;

-- ─── Invoices ───────────────────────────────────────────────────────────────
-- Invoices and credit notes issued in the period (not drafts or voids).
create function public.report_invoices(p_from date, p_to date)
returns table (
  id uuid, doc_type text, number text, issue_date date, due_date date, status text,
  paid_on date, customer_name text, salesperson text, net numeric, vat numeric, total numeric,
  adverts boolean
)
language sql stable security invoker set search_path = ''
as $$
  select d.id, d.doc_type, d.number, d.issue_date, d.due_date, d.status, (d.paid_at at time zone 'Europe/London')::date,
         c.name, coalesce(p.full_name, p.email), d.subtotal, d.vat_total, d.total,
         exists (select 1 from public.sales_document_lines l where l.document_id = d.id and l.magazine_issue_id is not null)
    from public.sales_documents d
    left join public.customers c on c.id = d.customer_id
    left join public.profiles p on p.id = d.owner_id
   where d.issue_date between p_from and p_to
     and ((d.doc_type = 'invoice' and d.status in ('issued', 'paid'))
       or (d.doc_type = 'credit_note' and d.status = 'issued'))
   order by d.issue_date, d.number;
$$;

-- ─── VAT on a cash basis ────────────────────────────────────────────────────
-- Invoices marked paid in the period, and credit notes issued in it (as
-- money going back), with their VAT by rate.
create function public.report_vat_cash(p_from date, p_to date)
returns table (
  id uuid, doc_type text, number text, cash_date date, customer_name text,
  tax_rate numeric, net numeric, vat numeric
)
language sql stable security invoker set search_path = ''
as $$
  with docs as (
    select d.id, d.doc_type, d.number, d.customer_id,
           case when d.doc_type = 'invoice' then (d.paid_at at time zone 'Europe/London')::date else d.issue_date end as cash_date,
           case when d.doc_type = 'credit_note' then -1 else 1 end as sign
      from public.sales_documents d
     where (d.doc_type = 'invoice' and d.status = 'paid' and (d.paid_at at time zone 'Europe/London')::date between p_from and p_to)
        or (d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between p_from and p_to)
  )
  select x.id, x.doc_type, x.number, x.cash_date, c.name, l.tax_rate,
         x.sign * sum(l.line_net), x.sign * sum(l.line_vat)
    from docs x
    join public.sales_document_lines l on l.document_id = x.id
    left join public.customers c on c.id = x.customer_id
   group by x.id, x.doc_type, x.number, x.cash_date, c.name, l.tax_rate, x.sign
   order by x.cash_date, x.number, l.tax_rate;
$$;

revoke execute on function public.report_bookings(date, date) from public, anon;
revoke execute on function public.report_invoices(date, date) from public, anon;
revoke execute on function public.report_vat_cash(date, date) from public, anon;
grant execute on function public.report_bookings(date, date) to authenticated;
grant execute on function public.report_invoices(date, date) to authenticated;
grant execute on function public.report_vat_cash(date, date) to authenticated;

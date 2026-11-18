-- Magazines, part 1 (27 October 2026).
--
-- Plain-English summary:
-- * The 11 Forget Me Not editions (A to K), each with its monthly sales target,
--   usual page count, format and distribution. Targets and page counts are
--   taken from Mag Manager's dashboard (November 2026) and can be changed.
-- * A monthly issue per edition (November 2026 to December 2027 to start),
--   each with its own pages, copy deadline, target and a "complete" switch.
-- * The advert sizes in use (with mm sizes from Mag Manager) and how much of a
--   page each takes, for counting pages booked. Default prices are empty until
--   the rate card arrives: every booking has its own price, as in Mag Manager.
-- * An advert is a line on a quote / sales order tagged with its issue and
--   size: one line per edition per month. So totals, margins, invoices and
--   Xero work as for every other sale. Lines keep their tags when a quote
--   becomes an order (on screen or accepted online).
-- * The Magazines dashboard counts sales-order lines as booked and sent quote
--   lines as provisional.
-- * Seeing editions, issues and sizes needs Magazines or Sales view (so sales
--   staff can quote adverts); changing them needs Magazines edit.

create table public.magazine_editions (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (length(trim(code)) between 1 and 3),
  name           text not null check (length(trim(name)) > 0),
  format         text not null default 'A5',
  distribution   integer check (distribution is null or distribution >= 0),
  default_pages  integer not null default 56 check (default_pages between 0 and 400),
  monthly_target numeric(12,2) check (monthly_target is null or monthly_target >= 0),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);

create table public.magazine_issues (
  id             uuid primary key default gen_random_uuid(),
  edition_id     uuid not null references public.magazine_editions (id) on delete cascade,
  month          date not null check (extract(day from month) = 1),
  pages          integer not null check (pages between 0 and 400),
  copy_deadline  date,
  sales_target   numeric(12,2) check (sales_target is null or sales_target >= 0),
  complete       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  unique (edition_id, month)
);
create index magazine_issues_month_idx on public.magazine_issues (month);

create table public.advert_sizes (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique check (length(trim(name)) > 0),
  width_mm       numeric(6,2),
  height_mm      numeric(6,2),
  page_fraction  numeric(6,4) not null check (page_fraction > 0 and page_fraction <= 4),
  default_price  numeric(10,2) check (default_price is null or default_price >= 0),
  position       integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);

alter table public.sales_document_lines
  add column magazine_issue_id uuid references public.magazine_issues (id) on delete restrict,
  add column advert_size_id uuid references public.advert_sizes (id) on delete restrict;
create index sales_document_lines_issue_idx on public.sales_document_lines (magazine_issue_id) where magazine_issue_id is not null;
create index sales_document_lines_size_idx on public.sales_document_lines (advert_size_id) where advert_size_id is not null;

-- ─── Access ─────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['magazine_editions', 'magazine_issues', 'advert_sizes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "View magazines" on public.%I for select to authenticated using ((select public.has_permission(''magazines'', ''view'')) or (select public.has_permission(''quotes'', ''view'')))', t);
    execute format('create policy "Add magazines" on public.%I for insert to authenticated with check ((select public.has_permission(''magazines'', ''edit'')))', t);
    execute format('create policy "Change magazines" on public.%I for update to authenticated using ((select public.has_permission(''magazines'', ''edit''))) with check ((select public.has_permission(''magazines'', ''edit'')))', t);
    execute format('create policy "Remove magazines" on public.%I for delete to authenticated using ((select public.has_permission(''magazines'', ''delete'')))', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_row()', t || '_touch', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'audit_' || t, t);
  end loop;
end $$;

-- ─── Starting data (from Mag Manager, 27 October 2026) ──────────────────────

insert into public.magazine_editions (code, name, distribution, default_pages, monthly_target) values
  ('A', 'Gosport', null, 56, 5000),
  ('B', 'Stubbington & Lee-on-the-Solent', null, 72, 7000),
  ('C', 'Portchester & Drayton', null, 56, 4250),
  ('D', 'Fareham', 10000, 88, 19000),
  ('E', 'Locks Heath and Whiteley', null, 80, 10000),
  ('F', 'Warsash & Hamble', null, 64, 7250),
  ('G', 'Hedge End', null, 56, 5500),
  ('H', 'West End & Boorley Green', null, 72, 4500),
  ('I', 'Chandler''s Ford', null, 80, 6500),
  ('J', 'Fair Oak & Boyatt Wood', null, 72, 4500),
  ('K', 'Meon Valley', null, 48, 5000);

insert into public.magazine_issues (edition_id, month, pages, sales_target)
select e.id, m::date, e.default_pages, e.monthly_target
  from public.magazine_editions e
 cross join generate_series(date '2026-11-01', date '2027-12-01', interval '1 month') m;

insert into public.advert_sizes (name, width_mm, height_mm, page_fraction, position) values
  ('Small Ad', 40, 45, 0.0625, 1),
  ('Eighth Page', 60, 45, 0.125, 2),
  ('FMN small ad ×2', 85, 45, 0.125, 3),
  ('Sixth Page - Portrait', 63, 60, 0.1667, 4),
  ('Quarter Page - Portrait', 60, 90, 0.25, 5),
  ('Quarter Page - Landscape', 130, 45, 0.25, 6),
  ('Third Page - Landscape', 130, 60, 0.3333, 7),
  ('Half Page - Landscape', 130, 90, 0.5, 8),
  ('Half Page - Portrait', 60, 190, 0.5, 9),
  ('Two Third Page', 130, 125, 0.6667, 10),
  ('Three Quarter Page', 130, 140, 0.75, 11),
  ('Full Page', 130, 190, 1, 12),
  ('Double Page Spread', 297, 210, 2, 13);

-- ─── Keep the tags when a quote accepted online becomes an order ────────────

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
     gp_override, gp_override_reason, gp_override_by, gp_override_at, magazine_issue_id, advert_size_id)
  select so, l.position, l.product_id, l.description, l.quantity, l.unit_price, l.unit_cost, l.discount_percent, l.tax_rate_id, l.tax_rate,
         l.gp_override, l.gp_override_reason, l.gp_override_by, l.gp_override_at, l.magazine_issue_id, l.advert_size_id
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

-- ─── Fix: adding an order line for a customer with no services ──────────────
-- If the customer had no services ticked and the line matched none, the list
-- came back empty-as-null and the save failed. Now it stays an empty list.

create or replace function public.tick_services_from_order()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  d record;
  matched text[];
  pname text;
begin
  select doc_type, customer_id into d from public.sales_documents where id = new.document_id;
  if d.doc_type is distinct from 'sales_order' then
    return new;
  end if;
  select name into pname from public.products where id = new.product_id;
  matched := public.services_for_line(new.account_code, coalesce(pname, new.description));
  update public.customers c set
    services = coalesce((select array_agg(distinct x order by x) from unnest(c.services || matched) x), '{}'),
    date_last_ordered = current_date
  where c.id = d.customer_id
    and (not (c.services @> matched) or c.date_last_ordered is distinct from current_date);
  return new;
end;
$$;
revoke execute on function public.tick_services_from_order() from anon, authenticated, public;

-- ─── Dashboard figures ──────────────────────────────────────────────────────

-- Each edition's issue for one month: pages, target, what's booked (sales
-- orders that aren't cancelled) and what's provisional (sent or accepted
-- quotes not yet turned into orders). Whole-business figures, so it ignores
-- "own records only"; it needs Magazines view.
create function public.magazine_month_summary(p_month date)
returns table (
  edition_id uuid, code text, name text, issue_id uuid, pages integer, sales_target numeric, complete boolean,
  booked_pages numeric, booked_net numeric, booked_count bigint, provisional_net numeric, provisional_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_permission('magazines', 'view') then
    raise exception 'Not allowed';
  end if;
  return query
  select e.id, e.code, e.name, i.id, i.pages, i.sales_target, i.complete,
         coalesce(sum(sz.page_fraction * l.quantity) filter (where d.doc_type = 'sales_order'), 0)::numeric,
         coalesce(sum(l.line_net) filter (where d.doc_type = 'sales_order'), 0)::numeric,
         count(l.id) filter (where d.doc_type = 'sales_order'),
         coalesce(sum(l.line_net) filter (where d.doc_type = 'quote'), 0)::numeric,
         count(l.id) filter (where d.doc_type = 'quote')
    from public.magazine_editions e
    left join public.magazine_issues i on i.edition_id = e.id and i.month = date_trunc('month', p_month)::date
    left join public.sales_document_lines l on l.magazine_issue_id = i.id
    left join public.sales_documents d on d.id = l.document_id
         and ((d.doc_type = 'sales_order' and d.status <> 'cancelled')
           or (d.doc_type = 'quote' and d.status in ('sent', 'accepted')))
    left join public.advert_sizes sz on sz.id = l.advert_size_id
   where e.active
   group by e.id, e.code, e.name, i.id, i.pages, i.sales_target, i.complete
   order by e.code;
end;
$$;

-- Every advert booked (or quoted) for one month, for the dashboard's list.
create function public.magazine_month_bookings(p_month date)
returns table (
  line_id uuid, document_id uuid, doc_type text, number text, status text, customer_id uuid, customer_name text,
  edition_code text, edition_name text, size_name text, line_net numeric, owner_name text, issue_date date
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_permission('magazines', 'view') then
    raise exception 'Not allowed';
  end if;
  return query
  select l.id, d.id, d.doc_type, d.number, d.status, c.id, c.name, e.code, e.name, sz.name, l.line_net,
         coalesce(p.full_name, p.email), d.issue_date
    from public.sales_document_lines l
    join public.magazine_issues i on i.id = l.magazine_issue_id
    join public.magazine_editions e on e.id = i.edition_id
    join public.sales_documents d on d.id = l.document_id
    left join public.customers c on c.id = d.customer_id
    left join public.advert_sizes sz on sz.id = l.advert_size_id
    left join public.profiles p on p.id = d.owner_id
   where i.month = date_trunc('month', p_month)::date
     and ((d.doc_type = 'sales_order' and d.status <> 'cancelled')
       or (d.doc_type = 'quote' and d.status in ('sent', 'accepted')))
   order by d.doc_type desc, d.issue_date desc, c.name, e.code;
end;
$$;

revoke execute on function public.magazine_month_summary(date) from public, anon;
revoke execute on function public.magazine_month_bookings(date) from public, anon;
grant execute on function public.magazine_month_summary(date) to authenticated;
grant execute on function public.magazine_month_bookings(date) to authenticated;

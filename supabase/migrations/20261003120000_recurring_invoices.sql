-- Wave 2c (part 1): recurring invoices.
--
-- Plain-English summary:
-- * A `recurring_invoices` row is a template: customer, lines, how often,
--   and the next date. It can be linked to a hosting plan or retainer.
-- * Every morning (06:00 UTC) the database creates any invoices that are due,
--   as drafts (or issued, if the template says so), then moves the next date
--   on. Admins can also run it on demand from the platform.
-- * Generated invoices link back to their template and go on the customer's
--   timeline. Numbering uses the normal INV- series.
-- * Runs entirely inside the database (pg_cron), so no secret keys needed.

-- Internal numbering helper with no permission check, for the scheduler.
-- Not callable by anyone from outside the database.
create function public._take_document_number(p_doc_type text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  s public.number_sequences%rowtype;
begin
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
revoke execute on function public._take_document_number(text) from anon, authenticated, public;

create table public.recurring_invoices (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(trim(name)) > 0),
  customer_id       uuid not null references public.customers (id) on delete restrict,
  contact_id        uuid references public.contacts (id) on delete set null,
  owner_id          uuid references public.profiles (id) on delete set null,
  hosting_plan_id   uuid references public.hosting_plans (id) on delete set null,
  retainer_id       uuid references public.retainers (id) on delete set null,
  frequency         text not null default 'monthly'
                    check (frequency in ('monthly', 'quarterly', 'six_monthly', 'annually')),
  next_date         date not null,
  end_date          date,
  status            text not null default 'active' check (status in ('active', 'paused', 'ended')),
  auto_issue        boolean not null default false,
  business_unit     text,
  customer_reference text,
  notes             text,
  internal_notes    text,
  subtotal          numeric(12,2) not null default 0,
  vat_total         numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  last_run_at       timestamptz,
  zoho_id           text unique,
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);

create index recurring_invoices_due_idx on public.recurring_invoices (status, next_date);
create index recurring_invoices_customer_idx on public.recurring_invoices (customer_id);

create table public.recurring_invoice_lines (
  id                    uuid primary key default gen_random_uuid(),
  recurring_invoice_id  uuid not null references public.recurring_invoices (id) on delete cascade,
  position              integer not null default 0,
  product_id            uuid references public.products (id) on delete set null,
  description           text not null default '',
  quantity              numeric(12,3) not null default 1,
  unit_price            numeric(12,2) not null default 0,
  unit_cost             numeric(12,2),
  discount_percent      numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  tax_rate_id           uuid references public.tax_rates (id) on delete set null,
  tax_rate              numeric(5,2) not null default 0,
  line_net              numeric(12,2) generated always as (round(quantity * unit_price * (1 - discount_percent / 100), 2)) stored,
  line_vat              numeric(12,2) generated always as (round(round(quantity * unit_price * (1 - discount_percent / 100), 2) * tax_rate / 100, 2)) stored,
  created_at            timestamptz not null default now()
);

create index recurring_invoice_lines_idx on public.recurring_invoice_lines (recurring_invoice_id, position);

alter table public.sales_documents add column recurring_invoice_id uuid references public.recurring_invoices (id) on delete set null;
create index sales_documents_recurring_idx on public.sales_documents (recurring_invoice_id);

create function public.recalc_recurring_invoice()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r uuid := coalesce(new.recurring_invoice_id, old.recurring_invoice_id);
begin
  update public.recurring_invoices t set
    subtotal  = coalesce((select sum(line_net) from public.recurring_invoice_lines where recurring_invoice_id = r), 0),
    vat_total = coalesce((select sum(line_vat) from public.recurring_invoice_lines where recurring_invoice_id = r), 0),
    total     = coalesce((select sum(line_net + line_vat) from public.recurring_invoice_lines where recurring_invoice_id = r), 0)
  where t.id = r;
  return null;
end;
$$;

create trigger recurring_invoice_lines_recalc
  after insert or update or delete on public.recurring_invoice_lines
  for each row execute function public.recalc_recurring_invoice();

create trigger recurring_invoices_touch before update on public.recurring_invoices
  for each row execute function public.touch_row();
create trigger audit_recurring_invoices after insert or update or delete on public.recurring_invoices
  for each row execute function public.audit_row();
create trigger audit_recurring_invoice_lines after insert or update or delete on public.recurring_invoice_lines
  for each row execute function public.audit_row();

do $$
declare
  t text;
begin
  foreach t in array array['recurring_invoices', 'recurring_invoice_lines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "View recurring" on public.%I for select to authenticated using (public.has_permission(''quotes'', ''view''))', t);
    execute format('create policy "Add recurring" on public.%I for insert to authenticated with check (public.has_permission(''quotes'', ''edit''))', t);
    execute format('create policy "Change recurring" on public.%I for update to authenticated using (public.has_permission(''quotes'', ''edit'')) with check (public.has_permission(''quotes'', ''edit''))', t);
    execute format('create policy "Remove recurring" on public.%I for delete to authenticated using (public.has_permission(''quotes'', ''delete''))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- The next date after `d` for a frequency.
create function public.advance_billing_date(d date, freq text)
returns date
language sql immutable set search_path = ''
as $$
  select (d + case freq
                when 'monthly' then interval '1 month'
                when 'quarterly' then interval '3 months'
                when 'six_monthly' then interval '6 months'
                else interval '12 months'
              end)::date;
$$;

-- Create one invoice from a template for its current next_date, then move
-- next_date on (or end the template if past its end date). Returns the new
-- invoice id. Internal — called by the scheduler and the admin "run now".
create function public._generate_recurring_invoice(p_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  t public.recurring_invoices%rowtype;
  s public.company_settings%rowtype;
  inv uuid;
  num text;
  period text;
begin
  select * into t from public.recurring_invoices where id = p_id for update;
  if not found or t.status <> 'active' then
    return null;
  end if;
  select * into s from public.company_settings limit 1;

  num := public._take_document_number('invoice');
  period := case t.frequency
              when 'monthly' then to_char(t.next_date, 'FMMonth YYYY')
              when 'annually' then to_char(t.next_date, 'FMMonth YYYY') || ' – ' || to_char(public.advance_billing_date(t.next_date, t.frequency) - 1, 'FMMonth YYYY')
              else to_char(t.next_date, 'FMMonth YYYY') || ' – ' || to_char(public.advance_billing_date(t.next_date, t.frequency) - 1, 'FMMonth YYYY')
            end;

  insert into public.sales_documents (
    doc_type, number, status, customer_id, contact_id, owner_id, recurring_invoice_id,
    title, customer_reference, issue_date, due_date, business_unit,
    notes, terms, internal_notes, sent_at
  ) values (
    'invoice', num, case when t.auto_issue then 'issued' else 'draft' end,
    t.customer_id, t.contact_id, t.owner_id, t.id,
    t.name || ' — ' || period, t.customer_reference, t.next_date,
    t.next_date + coalesce(s.invoice_due_days, 30), t.business_unit,
    coalesce(t.notes, s.invoice_notes), s.invoice_terms,
    'Created automatically from recurring invoice "' || t.name || '".',
    case when t.auto_issue then now() end
  ) returning id into inv;

  insert into public.sales_document_lines
    (document_id, position, product_id, description, quantity, unit_price, unit_cost, discount_percent, tax_rate_id, tax_rate)
  select inv, l.position, l.product_id, l.description, l.quantity, l.unit_price, l.unit_cost, l.discount_percent, l.tax_rate_id, l.tax_rate
    from public.recurring_invoice_lines l
   where l.recurring_invoice_id = t.id;

  insert into public.customer_activity (customer_id, contact_id, kind, body)
  values (t.customer_id, t.contact_id, 'system',
          'Recurring invoice ' || num || ' created (' || t.name || ', ' || period || ').');

  update public.recurring_invoices set
    next_date = public.advance_billing_date(t.next_date, t.frequency),
    status = case when t.end_date is not null and public.advance_billing_date(t.next_date, t.frequency) > t.end_date
                  then 'ended' else status end,
    last_run_at = now()
  where id = t.id;

  return inv;
end;
$$;
revoke execute on function public._generate_recurring_invoice(uuid) from anon, authenticated, public;

-- Create every invoice that's due today or earlier (catching up any missed
-- periods). Used by the daily schedule.
create function public.generate_due_recurring_invoices()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  made integer := 0;
  guard integer;
begin
  for r in select id from public.recurring_invoices where status = 'active' and next_date <= current_date loop
    guard := 0;
    -- Catch up, but never more than 24 periods in one go.
    while guard < 24 and exists (
      select 1 from public.recurring_invoices where id = r.id and status = 'active' and next_date <= current_date
    ) loop
      perform public._generate_recurring_invoice(r.id);
      made := made + 1;
      guard := guard + 1;
    end loop;
  end loop;
  return made;
end;
$$;
revoke execute on function public.generate_due_recurring_invoices() from anon, authenticated, public;

-- For staff: create the next invoice from one template straight away.
create function public.generate_recurring_invoice_now(p_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_permission('quotes', 'edit') then
    raise exception 'Not allowed';
  end if;
  return public._generate_recurring_invoice(p_id);
end;
$$;

-- For admins: run the whole daily job now.
create function public.run_recurring_billing_now()
returns integer
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can do this';
  end if;
  return public.generate_due_recurring_invoices();
end;
$$;

revoke execute on function public.generate_recurring_invoice_now(uuid) from anon, public;
revoke execute on function public.run_recurring_billing_now() from anon, public;
grant execute on function public.generate_recurring_invoice_now(uuid) to authenticated;
grant execute on function public.run_recurring_billing_now() to authenticated;
revoke execute on function public.recalc_recurring_invoice() from anon, public;

-- Daily schedule, 06:00 UTC.
create extension if not exists pg_cron;
select cron.schedule('generate-recurring-invoices', '0 6 * * *', 'select public.generate_due_recurring_invoices()');

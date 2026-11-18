-- GP override per line (6 October 2026).
--
-- Plain-English summary:
-- * The GP override moves from the whole quote/order/invoice to each line. On a
--   line, the operations team (and admins) can set the gross profit to a figure
--   they know is right. It records who and why, can be removed, and the line's
--   cost becomes whatever makes its gross profit equal that figure.
-- * The document's cost is simply the sum of its lines' costs again.
-- * Overrides are carried over when a quote becomes an order or invoice.
-- * The old whole-document override columns are left in place but no longer used.

alter table public.sales_document_lines
  add column gp_override         numeric(12,2),
  add column gp_override_reason  text,
  add column gp_override_by      uuid references public.profiles (id) on delete set null,
  add column gp_override_at      timestamptz;

-- A line's cost follows its override: cost = net - overridden gross profit.
alter table public.sales_document_lines drop column line_cost;
alter table public.sales_document_lines add column line_cost numeric(12,2) generated always as (
  case when gp_override is not null
       then round(quantity * unit_price * (1 - discount_percent / 100), 2) - gp_override
       else round(quantity * coalesce(unit_cost, 0), 2) end
) stored;

-- Totals are back to a plain sum of the lines.
create or replace function public.recalc_sales_document()
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

-- Retire the whole-document override.
drop trigger if exists sales_documents_gp_override on public.sales_documents;
drop function if exists public.apply_gp_override();
update public.sales_documents d
   set cost_total = coalesce((select sum(line_cost) from public.sales_document_lines l where l.document_id = d.id), 0)
 where d.gp_override is not null;

-- Who may set a line override, and the reason is mandatory.
create function public.apply_line_gp_override()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_setting('app.copying_overrides', true) = '1' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.gp_override is not distinct from old.gp_override
     and new.gp_override_reason is not distinct from old.gp_override_reason then
    return new;
  end if;
  if new.gp_override is null and tg_op = 'INSERT' then
    new.gp_override_reason := null; new.gp_override_by := null; new.gp_override_at := null;
    return new;
  end if;
  if not public.can_override_gp() then
    raise exception 'Only the operations team and admins can override gross profit';
  end if;
  if new.gp_override is not null then
    if new.gp_override_reason is null or length(trim(new.gp_override_reason)) = 0 then
      raise exception 'Please give a reason for the override';
    end if;
    new.gp_override_by := auth.uid();
    new.gp_override_at := now();
  else
    new.gp_override_reason := null; new.gp_override_by := null; new.gp_override_at := null;
  end if;
  return new;
end;
$$;
create trigger sales_document_lines_gp_override before insert or update on public.sales_document_lines
  for each row execute function public.apply_line_gp_override();

-- Carry line overrides from one document to another (e.g. quote → invoice),
-- matching lines by position. Only for people who can see both documents.
create function public.copy_line_overrides(p_from uuid, p_to uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (public.can_see_sales_document(p_from) and public.can_see_sales_document(p_to)) then
    raise exception 'Not allowed';
  end if;
  perform set_config('app.copying_overrides', '1', true);
  update public.sales_document_lines t
     set gp_override = s.gp_override, gp_override_reason = s.gp_override_reason,
         gp_override_by = s.gp_override_by, gp_override_at = s.gp_override_at
    from public.sales_document_lines s
   where s.document_id = p_from and s.gp_override is not null
     and t.document_id = p_to and t.position = s.position;
  perform set_config('app.copying_overrides', '0', true);
end;
$$;
revoke execute on function public.copy_line_overrides(uuid, uuid) from anon, public;
grant execute on function public.copy_line_overrides(uuid, uuid) to authenticated;

-- A quote accepted online becomes an order with its line overrides intact.
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
     gp_override, gp_override_reason, gp_override_by, gp_override_at)
  select so, l.position, l.product_id, l.description, l.quantity, l.unit_price, l.unit_cost, l.discount_percent, l.tax_rate_id, l.tax_rate,
         l.gp_override, l.gp_override_reason, l.gp_override_by, l.gp_override_at
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

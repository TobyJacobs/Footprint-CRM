-- Director's improvements (item 5): when a customer accepts a quote online,
-- it becomes a sales order straight away — no one has to press "Convert".
--
-- Plain-English summary:
-- * `_convert_quote_to_order` copies an accepted quote (and its lines) into a
--   new sales order, exactly like the "Convert to sales order" button does, and
--   marks the quote "converted".
-- * `respond_to_quote` now calls it when the customer clicks Accept. Declines
--   are unchanged.

create function public._convert_quote_to_order(p_quote_id uuid)
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

  insert into public.sales_document_lines
    (document_id, position, product_id, description, quantity, unit_price, unit_cost, discount_percent, tax_rate_id, tax_rate)
  select so, l.position, l.product_id, l.description, l.quantity, l.unit_price, l.unit_cost, l.discount_percent, l.tax_rate_id, l.tax_rate
    from public.sales_document_lines l
   where l.document_id = q.id;

  update public.sales_documents set status = 'converted' where id = q.id;

  insert into public.customer_activity (customer_id, contact_id, kind, body)
  values (q.customer_id, q.contact_id, 'system',
          'Sales order ' || num || ' created automatically from accepted quote ' || q.number || '.');
  return so;
end;
$$;
revoke execute on function public._convert_quote_to_order(uuid) from anon, authenticated, public;

create or replace function public.respond_to_quote(
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

  if p_accept then
    perform public._convert_quote_to_order(d.id);
  end if;
  return null;
end;
$$;

revoke execute on function public.respond_to_quote(uuid, boolean, text, text, text, text) from public;
grant execute on function public.respond_to_quote(uuid, boolean, text, text, text, text) to anon, authenticated;

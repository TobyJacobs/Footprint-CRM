-- Automatic sales orders get the customer's addresses (owner, 11 November 2026).
--
-- Plain-English summary:
-- * When a customer accepts a quote online, the sales order made for them now
--   copies the customer's billing and delivery addresses, the same as the
--   "Convert to sales order" button and a new order typed in by hand.
--   Before, those boxes were left blank.
-- * Existing orders are not changed.

create or replace function public._convert_quote_to_order(p_quote_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  q public.sales_documents%rowtype;
  s public.company_settings%rowtype;
  num text;
  so uuid;
  c public.customers%rowtype;
  bill text;
  ship text;
begin
  select * into q from public.sales_documents where id = p_quote_id and doc_type = 'quote' for update;
  if not found then
    raise exception 'Quote not found';
  end if;
  select * into s from public.company_settings limit 1;
  num := public._take_document_number('sales_order');

  -- The customer's addresses, one line each, as "Convert to sales order" does:
  -- delivery is the shipping address, or the billing address if there isn't one.
  select * into c from public.customers where id = q.customer_id;
  bill := nullif(concat_ws(E'\n', nullif(trim(c.billing_street), ''), nullif(trim(c.billing_city), ''),
                           nullif(trim(c.billing_county), ''), nullif(trim(c.billing_postcode), '')), '');
  ship := nullif(concat_ws(E'\n', nullif(trim(c.shipping_street), ''), nullif(trim(c.shipping_city), ''),
                           nullif(trim(c.shipping_county), ''), nullif(trim(c.shipping_postcode), '')), '');

  insert into public.sales_documents (
    doc_type, number, status, customer_id, contact_id, owner_id, source_document_id,
    title, customer_reference, issue_date, business_unit, delivery_type, labour_cost,
    production_step, deadline_date, notes, terms, internal_notes, quote_kind, plan_months, deposit_percent,
    billing_address, delivery_address
  ) values (
    'sales_order', num, 'open', q.customer_id, q.contact_id, q.owner_id, q.id,
    q.title, coalesce(q.response_po, q.customer_reference), current_date, q.business_unit,
    q.delivery_type, q.labour_cost, 'New Sales Order', q.deadline_date, q.notes,
    coalesce(s.order_terms, q.terms), q.internal_notes, q.quote_kind, q.plan_months, coalesce(q.deposit_percent, 0),
    bill, coalesce(ship, bill)
  ) returning id into so;

  perform set_config('app.copying_overrides', '1', true);
  insert into public.sales_document_lines
    (document_id, position, product_id, description, quantity, unit_price, unit_cost, discount_percent, tax_rate_id, tax_rate,
     gp_override, gp_override_reason, gp_override_by, gp_override_at, magazine_issue_id, advert_size_id,
     magazine_section_id, premium_position, billing)
  select so, l.position, l.product_id, l.description, l.quantity, l.unit_price, l.unit_cost, l.discount_percent, l.tax_rate_id, l.tax_rate,
         l.gp_override, l.gp_override_reason, l.gp_override_by, l.gp_override_at, l.magazine_issue_id, l.advert_size_id,
         l.magazine_section_id, l.premium_position, l.billing
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

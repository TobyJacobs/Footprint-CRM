-- Order confirmation (9 November 2026, DJ: "once approved, email the customer
-- an order confirmation with the SO number").
--
-- Plain-English summary:
-- * When a customer accepts a quote online, FootprintOS already makes the
-- sales order. Now it also emails them an order confirmation: the order
-- number, what they ordered and a link to view the order.
-- * The automatic order now also keeps the quote's kind, its line types
-- (one-off/monthly/included) and a proposal's payment plan and deposit, as the
-- "Convert to sales order" button already did.
-- * Only FootprintOS can fetch the details or record the email: it passes the
-- secret key (PORTAL_LINK_KEY), and only for a quote accepted in the last hour
-- whose order hasn't had a confirmation yet (so it's sent once).

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
    production_step, deadline_date, notes, terms, internal_notes, quote_kind, plan_months, deposit_percent
  ) values (
    'sales_order', num, 'open', q.customer_id, q.contact_id, q.owner_id, q.id,
    q.title, coalesce(q.response_po, q.customer_reference), current_date, q.business_unit,
    q.delivery_type, q.labour_cost, 'New Sales Order', q.deadline_date, q.notes,
    coalesce(s.order_terms, q.terms), q.internal_notes, q.quote_kind, q.plan_months, coalesce(q.deposit_percent, 0)
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

-- What the confirmation email needs, for a quote accepted online in the last
-- hour (null otherwise, or if its order already had a confirmation).
create function public.order_confirmation_details(p_key text, p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  q public.sales_documents;
  o public.sales_documents;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  select * into q from public.sales_documents
   where public_token = p_token and doc_type = 'quote' and status = 'converted'
     and responded_at > now() - interval '1 hour';
  if q.id is null then
    return null;
  end if;
  select * into o from public.sales_documents
   where source_document_id = q.id and doc_type = 'sales_order' order by created_at desc limit 1;
  if o.id is null or exists (select 1 from public.email_log where sales_document_id = o.id and subject like 'Order confirmation%') then
    return null;
  end if;
  return jsonb_build_object(
    'order_id', o.id, 'order_number', o.number, 'order_token', o.public_token, 'quote_number', q.number,
    'title', o.title, 'customer_reference', o.customer_reference, 'customer_id', o.customer_id,
    'customer_name', (select c.name from public.customers c where c.id = o.customer_id),
    'contact_first_name', (select p.first_name from public.contacts p where p.id = o.contact_id),
    'contact_email', (select p.email from public.contacts p where p.id = o.contact_id and p.erased_at is null),
    'owner_email', (select pr.email from public.profiles pr where pr.id = o.owner_id and pr.is_active),
    'owner_name', (select pr.full_name from public.profiles pr where pr.id = o.owner_id),
    'company_name', (select s.company_name from public.company_settings s limit 1),
    'subtotal', o.subtotal, 'vat_total', o.vat_total, 'total', o.total,
    'lines', coalesce((select jsonb_agg(jsonb_build_object('description', l.description, 'quantity', l.quantity,
                         'line_net', l.line_net, 'billing', l.billing) order by l.position)
                         from public.sales_document_lines l where l.document_id = o.id), '[]'::jsonb));
end;
$$;

-- Record the confirmation in the order's email history.
create function public.record_order_confirmation(p_key text, p_order uuid, p_to text, p_subject text, p_body text,
  p_status text, p_message_id text, p_error text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  if p_status not in ('sent', 'failed', 'test') then
    raise exception 'Bad request';
  end if;
  insert into public.email_log (sales_document_id, customer_id, to_addresses, subject, body, status, provider_message_id, error, sent_by)
  select o.id, o.customer_id, left(p_to, 500), left(p_subject, 300), left(p_body, 20000), p_status, left(p_message_id, 200), left(p_error, 500), null
    from public.sales_documents o where o.id = p_order and o.doc_type = 'sales_order';
end;
$$;

revoke execute on function public.order_confirmation_details(text, uuid) from public;
revoke execute on function public.record_order_confirmation(text, uuid, text, text, text, text, text, text) from public;
grant execute on function public.order_confirmation_details(text, uuid) to anon, authenticated;
grant execute on function public.record_order_confirmation(text, uuid, text, text, text, text, text, text) to anon, authenticated;

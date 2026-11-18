-- "Order again" in the customer portal (owner, 18 November 2026).
--
-- Plain-English summary:
-- * On a past order in their portal, a customer can click Order again: they
--   see its items at today's prices (the product's current price, or the
--   price they paid if it's not a catalogue product), change quantities or
--   leave items out, add a note and send it.
-- * It becomes a DRAFT quote on their record for the team to check and send
--   (then they accept it under Quotes), like advert booking. Adverts aren't
--   included (they're booked with Book more adverts).
-- * Only for the signed-in person's own companies; 5 requests an hour.

-- The order's items to order again, at today's prices.
create function public.portal_reorder_items(p_session text, p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_email text := public._portal_session_email(p_session);
  d public.sales_documents%rowtype;
begin
  if v_email is null then
    raise exception 'Please sign in again';
  end if;
  select * into d from public.sales_documents where public_token = p_token and doc_type in ('sales_order', 'invoice');
  if d.id is null or d.customer_id not in (select public._portal_customer_ids(v_email)) then
    return null;
  end if;
  return jsonb_build_object(
    'number', d.number, 'title', d.title, 'customer', (select name from public.customers where id = d.customer_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'description', l.description, 'quantity', l.quantity,
               'unit_price', case when p.id is not null and p.active then p.sale_price else round(l.unit_price * (1 - l.discount_percent / 100), 2) end,
               'billing', coalesce(l.billing, 'oneoff'))
             order by l.position)
        from public.sales_document_lines l
        left join public.products p on p.id = l.product_id
       where l.document_id = d.id and l.magazine_issue_id is null and coalesce(l.billing, 'oneoff') <> 'included'), '[]'::jsonb));
end;
$$;
revoke execute on function public.portal_reorder_items(text, uuid) from public;
grant execute on function public.portal_reorder_items(text, uuid) to anon, authenticated;

-- Send it: p_items = [{ id: line id, quantity }]; quantity 0 leaves it out.
create function public.portal_reorder(p_key text, p_session text, p_token uuid, p_items jsonb, p_note text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
  d public.sales_documents%rowtype;
  v_contact uuid;
  v_quote uuid;
  v_number text;
  v_pos integer := 0;
  r record;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  v_email := public._portal_session_email(p_session);
  if v_email is null then
    raise exception 'Please sign in again';
  end if;
  select * into d from public.sales_documents where public_token = p_token and doc_type in ('sales_order', 'invoice');
  if d.id is null or d.customer_id not in (select public._portal_customer_ids(v_email)) then
    raise exception 'Not allowed';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'Please choose what you''d like to order';
  end if;
  if (select count(*) from public.online_booking_requests where email = v_email and ip_hash = 'portal-reorder' and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many requests';
  end if;

  select ct.id into v_contact from public.contacts ct
   where ct.customer_id = d.customer_id and lower(trim(ct.email)) = v_email and ct.erased_at is null
   order by ct.is_primary desc limit 1;
  v_number := public._take_document_number('quote');
  insert into public.sales_documents (doc_type, number, status, customer_id, contact_id, owner_id, title, quote_kind, business_unit,
                                      issue_date, valid_until, expected_date, probability, notes, internal_notes, delivery_type)
  values ('quote', v_number, 'draft', d.customer_id, coalesce(v_contact, d.contact_id),
          coalesce(d.owner_id, (select c.owner_id from public.customers c where c.id = d.customer_id)),
          'Order again: ' || coalesce(nullif(d.title, ''), d.number) || ' (portal)', 'quote', d.business_unit,
          (now() at time zone 'Europe/London')::date, ((now() at time zone 'Europe/London')::date + 30),
          'This Month', 'Confident', nullif(left(trim(coalesce(p_note, '')), 2000), ''),
          'Order again request from the portal, based on ' || d.number || '.', d.delivery_type)
  returning id into v_quote;

  for r in
    select l.*, (i ->> 'quantity')::numeric as new_qty, p.id as product, p.active as product_active, p.sale_price, p.cost_price
      from jsonb_array_elements(p_items) i
      join public.sales_document_lines l on l.id = (i ->> 'id')::uuid and l.document_id = d.id
      left join public.products p on p.id = l.product_id
     where l.magazine_issue_id is null and coalesce(l.billing, 'oneoff') <> 'included'
       and (i ->> 'quantity')::numeric > 0
     order by l.position
  loop
    insert into public.sales_document_lines (document_id, position, product_id, product_code, description, quantity, unit_price, unit_cost,
                                             discount_percent, tax_rate_id, tax_rate, billing)
    values (v_quote, v_pos, r.product_id, r.product_code, r.description, least(r.new_qty, 1000000),
            case when r.product is not null and r.product_active then r.sale_price else round(r.unit_price * (1 - r.discount_percent / 100), 2) end,
            case when r.product is not null and r.product_active then coalesce(r.cost_price, r.unit_cost) else r.unit_cost end,
            0, r.tax_rate_id, r.tax_rate, r.billing);
    v_pos := v_pos + 1;
  end loop;
  if v_pos = 0 then
    raise exception 'Please choose at least one item';
  end if;

  insert into public.online_booking_requests (quote_id, email, ip_hash) values (v_quote, v_email, 'portal-reorder');
  insert into public.customer_activity (customer_id, contact_id, kind, body)
  values (d.customer_id, v_contact, 'system', 'Order again request from the portal (based on ' || d.number || '): quote ' || v_number || ' (draft, to check and send).');

  return jsonb_build_object(
    'quote_id', v_quote, 'number', v_number, 'customer', (select name from public.customers where id = d.customer_id),
    'from', d.number, 'email', v_email,
    'first_name', (select ct.first_name from public.contacts ct where ct.id = v_contact),
    'total', (select total from public.sales_documents where id = v_quote),
    'notify', coalesce((select jsonb_agg(distinct p.email) from public.profiles p
                         where p.is_active and p.id in (d.owner_id, (select c.owner_id from public.customers c where c.id = d.customer_id))), '[]'::jsonb));
end;
$$;
revoke execute on function public.portal_reorder(text, text, uuid, jsonb, text) from public;
grant execute on function public.portal_reorder(text, text, uuid, jsonb, text) to anon, authenticated;

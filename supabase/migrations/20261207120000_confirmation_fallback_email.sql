-- Order confirmation when the contact has no email (owner, 11 November 2026).
--
-- Plain-English summary:
-- * The order confirmation goes to the quote's contact. If that contact has no
--   email address saved, it now goes to the address the quote itself was
--   emailed to (the most recent one), instead of not being sent at all.
-- * Everything else about the confirmation is unchanged.

create or replace function public.order_confirmation_details(p_key text, p_token uuid)
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
    -- The contact's email, or else the first address the quote was emailed to.
    'contact_email', coalesce(
      nullif(trim((select p.email from public.contacts p where p.id = o.contact_id and p.erased_at is null)), ''),
      (select x from public.email_log e
         cross join lateral regexp_split_to_table(trim(e.to_addresses), '[,;[:space:]]+') x
        where e.sales_document_id = q.id and e.status in ('sent', 'test') and x like '%_@_%'
        order by e.sent_at desc nulls last limit 1)),
    'owner_email', (select pr.email from public.profiles pr where pr.id = o.owner_id and pr.is_active),
    'owner_name', (select pr.full_name from public.profiles pr where pr.id = o.owner_id),
    'company_name', (select s.company_name from public.company_settings s limit 1),
    'subtotal', o.subtotal, 'vat_total', o.vat_total, 'total', o.total,
    'lines', coalesce((select jsonb_agg(jsonb_build_object('description', l.description, 'quantity', l.quantity,
                         'line_net', l.line_net, 'billing', l.billing) order by l.position)
                         from public.sales_document_lines l where l.document_id = o.id), '[]'::jsonb));
end;
$$;

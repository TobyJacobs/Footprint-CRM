-- Advert deposits (6 November 2026).
--
-- Plain-English summary:
-- * Forget Me Not adverts have no contracts. As on the website calculator, if
--   the first advert is 3 or more months away, the customer can pay a 25%
--   deposit when they confirm and the rest before the first print deadline;
--   otherwise they pay in full (lib/magazine-deposit has the rule).
-- * The deposit and the balance are part invoices of the order. An order
--   that has been part-invoiced is billed by its part invoices, so "Create
--   invoices for [month]" leaves it alone (no advert is billed twice). When
--   the last part invoice is made, the order's adverts are marked as billed
--   by it, so the Magazines dashboard shows them as invoiced.
-- * The customer's quote page is told the first advert month, so it can show
--   the payment option.

-- ─── Monthly invoicing skips part-invoiced orders ──────────────────────────
create or replace function public.magazine_invoice_order(p_order uuid, p_month date, p_due date)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  so public.sales_documents%rowtype;
  s public.company_settings%rowtype;
  v_month date := date_trunc('month', p_month)::date;
  v_inv uuid;
  v_net numeric;
  v_billed numeric;
  v_num text;
begin
  if not public.has_permission('quotes', 'edit') then
    raise exception 'Not allowed';
  end if;
  select * into so from public.sales_documents where id = p_order and doc_type = 'sales_order' for update;
  if not found or not public.can_see_sales_document(p_order) then
    raise exception 'Sales order not found';
  end if;
  if so.status not in ('open', 'completed') then
    return null;
  end if;
  -- A deposit or other part invoice: the order is billed that way instead.
  if public.order_is_part_invoiced(p_order) then
    return null;
  end if;

  create temporary table _bill on commit drop as
    select l.* from public.sales_document_lines l
      join public.magazine_issues i on i.id = l.magazine_issue_id
     where l.document_id = p_order and i.month = v_month and l.invoiced_document_id is null;
  if not exists (select 1 from _bill) then
    drop table _bill;
    return null;
  end if;
  select sum(line_net) into v_net from _bill;

  select * into s from public.company_settings limit 1;
  v_num := public._take_document_number('invoice');
  insert into public.sales_documents (
    doc_type, number, status, customer_id, contact_id, owner_id, source_document_id, title, customer_reference,
    issue_date, due_date, business_unit, quote_kind, billing_address, labour_cost, notes, terms, internal_notes
  ) values (
    'invoice', v_num, 'draft', so.customer_id, so.contact_id, so.owner_id, so.id,
    'Forget Me Not adverts – ' || to_char(v_month, 'FMMonth YYYY'),
    so.customer_reference, current_date, coalesce(p_due, current_date + coalesce(s.invoice_due_days, 30)),
    so.business_unit, coalesce(so.quote_kind, 'quote'), so.billing_address,
    case when so.labour_cost is null or so.subtotal = 0 then null else round(so.labour_cost * v_net / so.subtotal, 2) end,
    coalesce(s.invoice_notes, so.notes), coalesce(s.invoice_terms, so.terms), so.internal_notes
  ) returning id into v_inv;

  insert into public.sales_document_lines
    (document_id, position, product_id, description, quantity, unit_price, unit_cost, discount_percent, tax_rate_id, tax_rate,
     magazine_issue_id, advert_size_id)
  select v_inv, row_number() over (order by b.position) - 1, b.product_id, b.description, b.quantity, b.unit_price, b.unit_cost,
         b.discount_percent, b.tax_rate_id, b.tax_rate, b.magazine_issue_id, b.advert_size_id
    from _bill b;

  update public.sales_document_lines set invoiced_document_id = v_inv where id in (select id from _bill);
  drop table _bill;

  -- Everything billed: the order is now invoiced.
  select coalesce(sum(subtotal), 0) into v_billed from public.sales_documents
   where source_document_id = p_order and doc_type = 'invoice' and status <> 'void';
  if v_billed >= so.subtotal - 0.005 then
    update public.sales_documents set status = 'invoiced' where id = p_order;
  end if;
  return v_inv;
end;
$$;

-- An order with an invoice (not void) that bills none of its lines directly:
-- a deposit, balance or other part invoice.
create function public.order_is_part_invoiced(p_order uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.sales_documents d
     where d.source_document_id = p_order and d.doc_type = 'invoice' and d.status <> 'void'
       and not exists (select 1 from public.sales_document_lines l where l.invoiced_document_id = d.id)
  );
$$;

-- ─── The last part invoice marks the order's adverts as billed ─────────────
create function public.magazine_mark_order_billed(p_order uuid, p_invoice uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.has_permission('quotes', 'edit') or not public.can_see_sales_document(p_order) then
    raise exception 'Not allowed';
  end if;
  if not exists (select 1 from public.sales_documents
                  where id = p_invoice and doc_type = 'invoice' and source_document_id = p_order and status <> 'void') then
    raise exception 'That invoice isn''t for this order';
  end if;
  update public.sales_document_lines set invoiced_document_id = p_invoice
   where document_id = p_order and magazine_issue_id is not null and invoiced_document_id is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ─── The customer's quote page knows the first advert month ────────────────
-- The customer's quote page, now with the first advert month (null if none).
create or replace function public.get_quote_by_token(p_token uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'number', d.number,
    'title', d.title,
    'status', d.status,
    'issue_date', d.issue_date,
    'valid_until', d.valid_until,
    'customer_reference', d.customer_reference,
    'notes', d.notes,
    'terms', d.terms,
    'subtotal', d.subtotal,
    'vat_total', d.vat_total,
    'total', d.total,
    'responded_at', d.responded_at,
    'response_name', d.response_name,
    'customer_name', c.name,
    'contact_name', nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'description', l.description, 'quantity', l.quantity, 'unit_price', l.unit_price,
               'discount_percent', l.discount_percent, 'tax_rate', l.tax_rate,
               'line_net', l.line_net) order by l.position)
        from public.sales_document_lines l where l.document_id = d.id), '[]'::jsonb),
    'first_advert_month', (select min(i.month) from public.sales_document_lines l
                             join public.magazine_issues i on i.id = l.magazine_issue_id
                            where l.document_id = d.id),
    'company', (select jsonb_build_object(
                  'company_name', s.company_name, 'address', s.address, 'phone', s.phone,
                  'email', s.email, 'website', s.website, 'vat_number', s.vat_number,
                  'company_number', s.company_number)
                  from public.company_settings s)
  )
  from public.sales_documents d
  join public.customers c on c.id = d.customer_id
  left join public.contacts p on p.id = d.contact_id
  where d.public_token = p_token
    and d.doc_type = 'quote'
    and d.status in ('sent', 'accepted', 'declined', 'converted');
$$;

revoke execute on function public.order_is_part_invoiced(uuid) from public, anon;
revoke execute on function public.magazine_mark_order_billed(uuid, uuid) from public, anon;
grant execute on function public.order_is_part_invoiced(uuid) to authenticated;
grant execute on function public.magazine_mark_order_billed(uuid, uuid) to authenticated;

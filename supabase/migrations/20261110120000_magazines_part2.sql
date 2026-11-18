-- Magazines, part 2 (27 October 2026): artwork and invoicing issue by issue.
--
-- Plain-English summary:
-- * Advert artwork goes into the same design queue as everything else (the
--   owner's rule). For each advert size on a sales order, staff choose: we
--   design it, the customer supplies it (a designer still checks it), or same
--   as last time (goes in as approved). Each makes a normal design job linked
--   to the sales order; adverts don't need a project. One job per order and
--   size. Sales staff can raise these even without Design access.
-- * Invoicing issue by issue: each advert line on a sales order remembers the
--   invoice that billed it. "Invoice a month" makes one draft invoice per order
--   with just that month's adverts (each customer's own payment terms), so
--   nothing is billed twice. The order becomes "Invoiced" once it's all billed.

alter table public.design_jobs
  add column advert_size_id uuid references public.advert_sizes (id) on delete set null,
  add column artwork_source text check (artwork_source in ('design', 'customer', 'repeat'));
create unique index design_jobs_order_size_idx on public.design_jobs (sales_order_id, advert_size_id)
  where advert_size_id is not null and sales_order_id is not null;
create index design_jobs_advert_size_idx on public.design_jobs (advert_size_id) where advert_size_id is not null;

alter table public.sales_document_lines
  add column invoiced_document_id uuid references public.sales_documents (id) on delete set null;
create index sales_document_lines_invoiced_idx on public.sales_document_lines (invoiced_document_id) where invoiced_document_id is not null;

-- ─── Artwork ────────────────────────────────────────────────────────────────

create function public.request_advert_artwork(p_order uuid, p_size uuid, p_source text, p_note text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  so public.sales_documents%rowtype;
  sz public.advert_sizes%rowtype;
  v_customer text;
  v_editions text;
  v_months text;
  v_due date;
  v_id uuid;
begin
  if not (public.has_permission('quotes', 'edit') or public.has_permission('design', 'view')) then
    raise exception 'Not allowed';
  end if;
  if p_source not in ('design', 'customer', 'repeat') then
    raise exception 'Unknown artwork choice';
  end if;
  select * into so from public.sales_documents where id = p_order and doc_type = 'sales_order';
  if not found or not public.can_see_sales_document(p_order) then
    raise exception 'Sales order not found';
  end if;
  select * into sz from public.advert_sizes where id = p_size;
  if not found or not exists (select 1 from public.sales_document_lines where document_id = p_order and advert_size_id = p_size) then
    raise exception 'This order has no advert of that size';
  end if;
  if exists (select 1 from public.design_jobs where sales_order_id = p_order and advert_size_id = p_size) then
    raise exception 'Artwork for this advert is already in the design queue';
  end if;

  select c.name into v_customer from public.customers c where c.id = so.customer_id;
  select string_agg(x.label, ', ' order by x.code) into v_editions
    from (select distinct e.code, e.code || '. ' || e.name label
            from public.sales_document_lines l
            join public.magazine_issues i on i.id = l.magazine_issue_id
            join public.magazine_editions e on e.id = i.edition_id
           where l.document_id = p_order and l.advert_size_id = p_size) x;
  select string_agg(to_char(x.month, 'FMMonth YYYY'), ', ' order by x.month), min(x.due) into v_months, v_due
    from (select i.month, min(coalesce(i.copy_deadline, i.month - 14)) due
            from public.sales_document_lines l
            join public.magazine_issues i on i.id = l.magazine_issue_id
           where l.document_id = p_order and l.advert_size_id = p_size
           group by i.month) x;

  insert into public.design_jobs (
    title, brief, customer_id, sales_order_id, due_date, stage, advert_size_id, artwork_source
  ) values (
    sz.name || ' advert – ' || coalesce(v_customer, 'customer'),
    case p_source
      when 'design' then 'We design this advert.'
      when 'customer' then 'The customer is supplying the artwork: check it fits and is print-ready.'
      else 'Same artwork as last time: reuse the previous advert.'
    end
    || E'\n\nForget Me Not, ' || sz.name
    || coalesce(' (' || trim(to_char(sz.width_mm, 'FM9999.##')) || ' × ' || trim(to_char(sz.height_mm, 'FM9999.##')) || ' mm)', '')
    || E'\nEditions: ' || coalesce(v_editions, '—')
    || E'\nMonths: ' || coalesce(v_months, '—')
    || E'\nSales order: ' || so.number
    || coalesce(E'\n\n' || nullif(trim(p_note), ''), ''),
    so.customer_id, so.id, v_due,
    case when p_source = 'repeat' then 'approved' else 'todo' end,
    sz.id, p_source
  ) returning id into v_id;
  return v_id;
end;
$$;

-- ─── Invoicing issue by issue ───────────────────────────────────────────────

-- One draft invoice for one order's adverts in one month. Returns the new
-- invoice's id, or null if there was nothing left to bill. The due date is
-- worked out by FootprintOS from the customer's payment terms.
create function public.magazine_invoice_order(p_order uuid, p_month date, p_due date)
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

-- An invoice deleted while still a draft: its adverts can be billed again.
-- (Voided invoices keep their link, so voiding needs a credit note and a new
-- invoice, as for any sale.)

-- ─── Dashboard list, now with artwork and invoice ───────────────────────────

drop function public.magazine_month_bookings(date);
create function public.magazine_month_bookings(p_month date)
returns table (
  line_id uuid, document_id uuid, doc_type text, number text, status text, customer_id uuid, customer_name text,
  edition_code text, edition_name text, size_name text, line_net numeric, owner_name text, issue_date date,
  artwork_job_id uuid, artwork_stage text, artwork_source text, invoice_id uuid, invoice_number text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_permission('magazines', 'view') then
    raise exception 'Not allowed';
  end if;
  return query
  select l.id, d.id, d.doc_type, d.number, d.status, c.id, c.name, e.code, e.name, sz.name, l.line_net,
         coalesce(p.full_name, p.email), d.issue_date,
         j.id, j.stage, j.artwork_source, inv.id, inv.number
    from public.sales_document_lines l
    join public.magazine_issues i on i.id = l.magazine_issue_id
    join public.magazine_editions e on e.id = i.edition_id
    join public.sales_documents d on d.id = l.document_id
    left join public.customers c on c.id = d.customer_id
    left join public.advert_sizes sz on sz.id = l.advert_size_id
    left join public.profiles p on p.id = d.owner_id
    left join public.design_jobs j on j.sales_order_id = d.id and j.advert_size_id = l.advert_size_id
    left join public.sales_documents inv on inv.id = l.invoiced_document_id
   where i.month = date_trunc('month', p_month)::date
     and ((d.doc_type = 'sales_order' and d.status <> 'cancelled')
       or (d.doc_type = 'quote' and d.status in ('sent', 'accepted')))
   order by d.doc_type desc, d.issue_date desc, c.name, e.code;
end;
$$;

revoke execute on function public.request_advert_artwork(uuid, uuid, text, text) from public, anon;
revoke execute on function public.magazine_invoice_order(uuid, date, date) from public, anon;
revoke execute on function public.magazine_month_bookings(date) from public, anon;
grant execute on function public.request_advert_artwork(uuid, uuid, text, text) to authenticated;
grant execute on function public.magazine_invoice_order(uuid, date, date) to authenticated;
grant execute on function public.magazine_month_bookings(date) to authenticated;

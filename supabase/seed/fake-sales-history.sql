-- MADE-UP sales history for the TEST database only, so the charts in
-- Quotes & Invoices have something to show in demos. Never run on live.
--
-- Creates roughly 12 to 21 quotes a month for the last 12 months, using the
-- fake customers and products. About 60% are won and become paid or unpaid
-- invoices (with some overdue); some are declined; recent ones are still open.
-- A few credit notes too. Everything is marked "DEMO DATA" in the internal
-- notes, so it can be found and removed:
--   delete from public.sales_documents where internal_notes = 'DEMO DATA';

do $$
declare
  m int;
  i int;
  k int;
  owner uuid;
  cust uuid;
  q uuid;
  inv uuid;
  d date;
  inv_date date;
  due date;
  st text;
  r float;
  p record;
begin
  select id into owner from public.profiles where is_admin order by created_at limit 1;

  for m in 0..11 loop
    for i in 1..(12 + floor(random() * 10))::int loop
      d := least(current_date, (date_trunc('month', current_date) - make_interval(months => m))::date + floor(random() * 28)::int);
      select id into cust from public.customers where erased_at is null order by random() limit 1;
      r := random();
      st := case
              when m = 0 and r < 0.45 then 'sent'
              when r < 0.60 then 'converted'
              when r < 0.88 then 'declined'
              else case when m <= 1 then 'sent' else 'declined' end
            end;

      insert into public.sales_documents
        (doc_type, number, status, customer_id, owner_id, title, issue_date, valid_until, sent_at, internal_notes)
      values
        ('quote', public._take_document_number('quote'), st, cust, owner, 'Demo job', d, d + 30, d, 'DEMO DATA')
      returning id into q;

      k := 0;
      for p in select pr.id, pr.name, pr.sale_price, pr.cost_price, pr.tax_rate_id, coalesce(t.rate, 20) as rate
                 from public.products pr left join public.tax_rates t on t.id = pr.tax_rate_id
                where pr.active order by random() limit (1 + floor(random() * 3))::int loop
        insert into public.sales_document_lines
          (document_id, position, product_id, description, quantity, unit_price, unit_cost, tax_rate_id, tax_rate)
        values
          (q, k, p.id, p.name, 1 + floor(random() * 6), p.sale_price, coalesce(p.cost_price, 0), p.tax_rate_id, p.rate);
        k := k + 1;
      end loop;

      if st = 'converted' then
        inv_date := least(current_date, d + 5 + floor(random() * 20)::int);
        due := inv_date + 30;
        insert into public.sales_documents
          (doc_type, number, status, customer_id, owner_id, source_document_id, title, issue_date, due_date, sent_at, internal_notes)
        values
          ('invoice', public._take_document_number('invoice'),
           case when due < current_date and random() < 0.85 then 'paid'
                when due >= current_date and random() < 0.25 then 'paid'
                else 'issued' end,
           cust, owner, q, 'Demo job', inv_date, due, inv_date, 'DEMO DATA')
        returning id into inv;

        insert into public.sales_document_lines
          (document_id, position, product_id, description, quantity, unit_price, unit_cost, tax_rate_id, tax_rate)
        select inv, position, product_id, description, quantity, unit_price, unit_cost, tax_rate_id, tax_rate
          from public.sales_document_lines where document_id = q;

        -- The odd credit note (about 1 in 15 invoices): 10% off.
        if random() < 0.07 then
          insert into public.sales_documents
            (doc_type, number, status, customer_id, owner_id, source_document_id, title, issue_date, credit_reason, internal_notes)
          values
            ('credit_note', public._take_document_number('credit_note'), 'issued', cust, owner, inv,
             'Demo credit', least(current_date, inv_date + 10), 'Goodwill gesture', 'DEMO DATA')
          returning id into q;
          insert into public.sales_document_lines
            (document_id, position, description, quantity, unit_price, unit_cost, tax_rate_id, tax_rate)
          select q, 0, 'Goodwill discount (10%)', 1, round(subtotal * 0.10, 2), 0,
                 (select id from public.tax_rates where is_default limit 1), 20
            from public.sales_documents where id = inv;
        end if;
      end if;
    end loop;
  end loop;
end $$;

-- After migration 20261007120000 (paid dates): give the made-up paid invoices
-- a believable paid date, 5 to 40 days after they were issued.
update public.sales_documents
   set paid_at = least(now(), (issue_date + (5 + floor(random() * 36))::int)::timestamptz)
 where internal_notes = 'DEMO DATA' and doc_type = 'invoice' and status = 'paid';

-- Made-up open sales orders and purchase orders, so the Operations home page
-- has something to show. Also marked DEMO DATA.
do $$
declare
  i int; so uuid; po uuid; cust uuid; sup uuid; owner uuid; p record;
  steps text[] := array['New Sales Order', 'Artwork', 'Proofing', 'Printing', 'Finishing', 'Ready for delivery'];
begin
  select id into owner from public.profiles where is_admin order by created_at limit 1;
  for i in 1..14 loop
    select id into cust from public.customers where erased_at is null order by random() limit 1;
    insert into public.sales_documents
      (doc_type, number, status, customer_id, owner_id, title, issue_date, deadline_date, production_step, internal_notes)
    values
      ('sales_order', public._take_document_number('sales_order'), 'open', cust, owner, 'Demo order',
       current_date - (1 + floor(random() * 20))::int, current_date + (floor(random() * 26) - 5)::int,
       steps[1 + floor(random() * 6)::int], 'DEMO DATA')
    returning id into so;
    for p in select pr.id, pr.name, pr.sale_price, pr.cost_price, pr.tax_rate_id, pr.supplier_id, coalesce(t.rate, 20) as rate
               from public.products pr left join public.tax_rates t on t.id = pr.tax_rate_id
              where pr.active order by random() limit (1 + floor(random() * 2))::int loop
      insert into public.sales_document_lines
        (document_id, position, product_id, description, quantity, unit_price, unit_cost, tax_rate_id, tax_rate)
      values (so, 0, p.id, p.name, 1 + floor(random() * 4), p.sale_price, coalesce(p.cost_price, 0), p.tax_rate_id, p.rate);
    end loop;
  end loop;

  for i in 1..9 loop
    select id into sup from public.suppliers order by random() limit 1;
    insert into public.purchase_orders
      (number, status, supplier_id, owner_id, issue_date, expected_date, deliver_to, internal_notes, sent_at, received_at)
    values
      (public._take_document_number('purchase_order'),
       case when i <= 2 then 'draft' when i <= 7 then 'sent' else 'received' end,
       sup, owner, current_date - (floor(random() * 15))::int,
       current_date + (floor(random() * 14) - 6)::int, 'Footprint Group', 'DEMO DATA',
       case when i > 2 then now() end, case when i > 7 then now() end)
    returning id into po;
    insert into public.purchase_order_lines (purchase_order_id, position, description, quantity, unit_cost, tax_rate, tax_rate_id)
    values (po, 0, 'Demo supplies', 1 + floor(random() * 5), 20 + floor(random() * 150),
            20, (select id from public.tax_rates where is_default limit 1));
  end loop;
end $$;

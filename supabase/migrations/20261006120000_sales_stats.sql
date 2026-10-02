-- Director's improvements (item 4): figures for the charts in Quotes & Invoices.
--
-- Plain-English summary: one function adds up quotes, invoices, credit notes
-- and what's owed, month by month, inside the database, so it stays fast and
-- accurate however many documents there are. It runs as the person asking
-- (security invoker), so row-level security still decides what they can see.
-- Money is net of VAT, except "owed", which is what customers actually owe.

create function public.sales_stats(p_from date, p_owner uuid default null)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with docs as (
    select d.*
      from public.sales_documents d
     where d.issue_date >= p_from
       and d.status <> 'draft'
       and (p_owner is null or d.owner_id = p_owner)
  ),
  monthly as (
    select to_char(date_trunc('month', issue_date), 'YYYY-MM') as month,
           coalesce(sum(subtotal) filter (where doc_type = 'quote'), 0) as quoted,
           coalesce(sum(subtotal) filter (where doc_type = 'quote' and status in ('accepted', 'converted')), 0) as won,
           coalesce(sum(subtotal) filter (where doc_type = 'quote' and status = 'declined'), 0) as lost,
           coalesce(sum(subtotal) filter (where doc_type = 'invoice' and status in ('issued', 'paid')), 0) as invoiced,
           coalesce(sum(subtotal) filter (where doc_type = 'credit_note' and status = 'issued'), 0) as credited,
           coalesce(sum(subtotal) filter (where doc_type = 'invoice' and status = 'paid'), 0) as paid,
           coalesce(sum(subtotal) filter (where doc_type = 'invoice' and status = 'issued'), 0) as unpaid,
           coalesce(sum(cost_total) filter (where doc_type = 'invoice' and status in ('issued', 'paid')), 0) as cost
      from docs
     group by 1
  ),
  quotes as (
    select count(*) filter (where doc_type = 'quote' and status in ('accepted', 'converted')) as won,
           count(*) filter (where doc_type = 'quote' and status = 'declined') as lost,
           count(*) filter (where doc_type = 'quote' and status = 'sent') as open_count,
           coalesce(sum(subtotal) filter (where doc_type = 'quote' and status = 'sent'), 0) as open_value
      from docs
  ),
  top_customers as (
    select c.name,
           sum(case when d.doc_type = 'invoice' then d.subtotal else -d.subtotal end) as value
      from docs d
      join public.customers c on c.id = d.customer_id
     where (d.doc_type = 'invoice' and d.status in ('issued', 'paid'))
        or (d.doc_type = 'credit_note' and d.status = 'issued')
     group by c.id, c.name
    having sum(case when d.doc_type = 'invoice' then d.subtotal else -d.subtotal end) > 0
     order by 2 desc
     limit 8
  ),
  owed as (
    select i.due_date,
           i.total - coalesce((select sum(cn.total) from public.sales_documents cn
                                where cn.source_document_id = i.id and cn.doc_type = 'credit_note'
                                  and cn.status = 'issued'), 0) as balance
      from public.sales_documents i
     where i.doc_type = 'invoice' and i.status = 'issued'
       and (p_owner is null or i.owner_id = p_owner)
  )
  select jsonb_build_object(
    'months', coalesce((select jsonb_agg(to_jsonb(m) order by m.month) from monthly m), '[]'::jsonb),
    'quotes', (select to_jsonb(q) from quotes q),
    'top', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'value', t.value) order by t.value desc) from top_customers t), '[]'::jsonb),
    'owed', (select jsonb_build_object(
               'not_due', coalesce(sum(balance) filter (where due_date is null or due_date >= current_date), 0),
               'd30', coalesce(sum(balance) filter (where current_date - due_date between 1 and 30), 0),
               'd60', coalesce(sum(balance) filter (where current_date - due_date between 31 and 60), 0),
               'd90', coalesce(sum(balance) filter (where current_date - due_date between 61 and 90), 0),
               'over90', coalesce(sum(balance) filter (where current_date - due_date > 90), 0))
               from owed where balance > 0)
  );
$$;

revoke execute on function public.sales_stats(date, uuid) from anon, public;
grant execute on function public.sales_stats(date, uuid) to authenticated;
